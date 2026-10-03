import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import {
  Command,
  commandSchema,
  GameStateForClient,
  gameStateSchema,
  WordCard,
  SharedEffect,
  animalSchema,
  CardMark,
  sessionHistorySchema,
  SessionHistory,
  SessionRound,
  SessionEvent,
} from "schema";
import { Env } from "./worker";
import { isReconnectToken, publicPlayerId } from "./identity";
import {
  Codenames,
  defaultParameters,
  GameError,
  initialGameState,
} from "game";
import {
  classic,
  randomAnimalEmoji,
  wordPacks,
  BuiltInWordPackId,
} from "words";

const GAME_STATE = "gameState";
const DISCONNECT_GRACE_MS = 60_000;
const ROOM_SETTINGS = "roomSettings";
const DISCONNECTED = "disconnected";
const MARKS = "marks";
const REACTION_COOLDOWN_MS = 400;
const SHUFFLE_AT = "shuffleAt";
/** The shuffle ceremony: everyone watches the same countdown, then teams change at once. */
export const SHUFFLE_COUNTDOWN_MS = 3_000;

type Cue = SharedEffect["type"] | Omit<SharedEffect, "id" | "playAt">;
type StoredMark = CardMark & { turnUntil: number };
const ROOM_EXPIRES_AT = "roomExpiresAt";
const SESSION_HISTORY = "sessionHistory";
const MAX_SESSION_ROUNDS = 50;
const MAX_ROUND_EVENTS = 200;
// Legacy Durable Object KV values are limited to 128 KiB; leave serialization headroom.
const MAX_HISTORY_BYTES = 96 * 1024;
const DEFAULT_ROOM_IDLE_TTL_SECONDS = 14 * 24 * 60 * 60;

export class CodenamesGame extends DurableObject {
  private roomExpiresAt: number | undefined;
  private readonly roomIdleTtlMs: number;
  private disconnected: Record<string, number> = {};
  private selectedWordPack = "classic";
  private selectedTeamCount = 2;
  private customWords: string[] = [];
  // Cached between events; dropped after any failed command so storage stays the source of truth.
  private game: Codenames | undefined;
  private marks: StoredMark[] = [];
  /** When a requested shuffle happens; presses during the countdown are ignored. */
  private shuffleAt: number | undefined;
  private lastReactionAt = new Map<string, number>();
  private sessionHistory: SessionHistory = {
    rounds: [],
    awardSeed: crypto.randomUUID(),
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const configuredTtl = Number(env.ROOM_IDLE_TTL_SECONDS);
    this.roomIdleTtlMs =
      (Number.isSafeInteger(configuredTtl) &&
      configuredTtl >= 60 &&
      Date.now() + configuredTtl * 1000 <= 8.64e15
        ? configuredTtl
        : DEFAULT_ROOM_IDLE_TTL_SECONDS) * 1000;
    this.ctx.blockConcurrencyWhile(async () => {
      this.roomExpiresAt =
        (await this.ctx.storage.get<number | null>(ROOM_EXPIRES_AT)) ??
        undefined;
      if (await this.deleteExpiredRoom()) return;
      // Do not recreate storage when a deleted object's alarm is retried.
      if (!(await this.ctx.storage.get<string>(GAME_STATE))) return;
      const settings = await this.ctx.storage.get<{
        wordPack: string;
        teamCount: number;
        customWords?: string[];
      }>(ROOM_SETTINGS);
      if (settings) {
        this.selectedWordPack = settings.wordPack;
        this.selectedTeamCount = settings.teamCount;
        this.customWords = settings.customWords ?? [];
      }
      const history =
        await this.ctx.storage.get<SessionHistory>(SESSION_HISTORY);
      if (history) {
        const parsed = sessionHistorySchema.safeParse(history);
        if (parsed.success)
          this.sessionHistory = {
            ...parsed.data,
            awardSeed:
              parsed.data.awardSeed ??
              parsed.data.rounds[0]?.id ??
              this.sessionHistory.awardSeed,
          };
        else console.error("Invalid session history, resetting:", parsed.error);
      }
      this.disconnected =
        (await this.ctx.storage.get<Record<string, number>>(DISCONNECTED)) ??
        {};
      this.marks = (await this.ctx.storage.get<StoredMark[]>(MARKS)) ?? [];
      this.shuffleAt =
        (await this.ctx.storage.get<number | null>(SHUFFLE_AT)) ?? undefined;
      const game = await this.getGameInstance();
      const connectedIds = new Set(
        this.ctx
          .getWebSockets()
          .filter((ws) => ws.readyState === 1)
          .map((ws) => ws.deserializeAttachment()?.playerId),
      );
      for (const player of game.getGameState().players) {
        if (!connectedIds.has(player.id) && !this.disconnected[player.id]) {
          this.disconnected[player.id] = Date.now() + DISCONNECT_GRACE_MS;
        }
      }
      await this.persistAndBroadcastGameState(game);
    });
  }

  async getGameInstance(): Promise<Codenames> {
    this.game ??= await this.loadGameInstance();
    return this.game;
  }

  private async loadGameInstance(): Promise<Codenames> {
    // One durable alarm serves turn deadlines, reconnect grace and room expiry.
    const onScheduleCallAdvanceTurn = (_date: Date) => {};
    const parameters = {
      ...defaultParameters,
      teamCount: this.selectedTeamCount,
    };

    const state = await this.ctx.storage.get<string>(GAME_STATE);
    if (!state) {
      return new Codenames(
        structuredClone(initialGameState),
        classic,
        onScheduleCallAdvanceTurn,
        parameters,
      );
    }

    try {
      const gameState = gameStateSchema.parse(JSON.parse(state));
      return new Codenames(
        gameState,
        classic,
        onScheduleCallAdvanceTurn,
        parameters,
      );
    } catch (error) {
      console.error(
        "Corrupted game state, resetting. Parse error:",
        error,
        "Raw state (first 500 chars):",
        state.slice(0, 500),
      );
      // Clear the corrupted state so it doesn't persist
      await this.ctx.storage.delete(GAME_STATE);
      return new Codenames(
        structuredClone(initialGameState),
        classic,
        onScheduleCallAdvanceTurn,
        parameters,
      );
    }
  }

  async fetch(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(() => this.handleFetch(request));
  }

  // Internal RPC for a one-time namespace sweep. Never creates a player or
  // extends an existing deadline, and only already-expired rooms are removed.
  async enrollRoomExpiry(): Promise<{
    status: "empty" | "active" | "idle";
    expiresAt?: number;
  }> {
    return this.ctx.blockConcurrencyWhile(async () => {
      await this.deleteExpiredRoom();
      if (!(await this.ctx.storage.get<string>(GAME_STATE)))
        return { status: "empty" as const };
      const game = await this.getGameInstance();
      await this.persistAndBroadcastGameState(game);
      return this.hasConnectedPlayers()
        ? { status: "active" as const }
        : { status: "idle" as const, expiresAt: this.roomExpiresAt };
    });
  }

  private async handleFetch(request: Request): Promise<Response> {
    await this.deleteExpiredRoom();
    const url = new URL(request.url);
    // Old clients sent their (publicly broadcast) id as "playerId"; it must never act as a credential.
    const candidateToken = url.searchParams.get("token");
    const token = isReconnectToken(candidateToken) ? candidateToken : nanoid();
    const playerId = await publicPlayerId(token);

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Restore state
    const game = await this.getGameInstance();
    const existingPlayers = game.getGameState().players;

    // Accept WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Reconnect as the existing player or join as a new one
    if (!existingPlayers.some((p) => p.id === playerId)) {
      const name =
        url.searchParams.get("name")?.trim().slice(0, 50) ||
        randomAnimalEmoji().split(" ").slice(1).join(" ");
      game.joinGame({ id: playerId, name });
      const animal = animalSchema.safeParse(url.searchParams.get("animal"));
      if (animal.success) {
        const player = game
          .getGameState()
          .players.find((p) => p.id === playerId)!;
        game.addOrUpdatePlayer({ ...player, animal: animal.data });
      }
    }
    delete this.disconnected[playerId];

    server.serializeAttachment({ playerId });

    await this.persistAndBroadcastGameState(game);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    // Parse JSON
    let parsedCommand;
    try {
      parsedCommand = commandSchema.parse(JSON.parse(message.toString()));
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return;
    }

    // Handle ping
    if (parsedCommand.type === "ping") {
      try {
        ws.send(JSON.stringify({ type: "pong", serverTime: Date.now() }));
      } catch {
        // Client already gone
      }
      return;
    }

    // Ephemeral signals skip the concurrency block and storage, and fail silently.
    if (parsedCommand.type === "react") {
      this.broadcastReaction(ws, parsedCommand.emoji);
      return;
    }
    if (parsedCommand.type === "typing") {
      this.relayTyping(ws, parsedCommand.typing);
      return;
    }

    // Catch expected rejections inside the concurrency block: an escaping error resets the object.
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        await this.handleCommand(parsedCommand, ws);
      } catch (error) {
        this.game = undefined;
        if (error instanceof GameError) {
          console.info("Command was rejected. Reason:", error.message);
          const commandRejectedEvent = {
            type: "commandRejected",
            reason: error.message,
          };
          try {
            ws.send(JSON.stringify(commandRejectedEvent));
          } catch {
            // Client already gone
          }
        } else {
          console.error("Failed to handle command:", error);
        }
      }
    });
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      if (await this.deleteExpiredRoom()) return;
      if (!(await this.ctx.storage.get<string>(GAME_STATE))) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      const game = await this.getGameInstance();
      const now = Date.now();
      const connectedIds = new Set(
        this.ctx
          .getWebSockets()
          .filter((ws) => ws.readyState === 1)
          .map((ws) => ws.deserializeAttachment()?.playerId),
      );
      for (const [id, deadline] of Object.entries(this.disconnected)) {
        if (connectedIds.has(id)) delete this.disconnected[id];
        else if (deadline <= now) {
          game.removePlayer(id);
          delete this.disconnected[id];
        }
      }
      if (this.shuffleAt !== undefined && this.shuffleAt <= now) {
        this.shuffleAt = undefined;
        // A game that started meanwhile keeps its teams.
        if (!game.getGameState().turn) game.shuffleTeams();
      }
      const turn = game.getGameState().turn;
      let effects: SharedEffect[] = [];
      if (turn && +turn.until <= now && !game.getGameResult()) {
        game.advanceTurn();
        effects = this.effects({
          type: "turnChange",
          team: game.getGameState().turn!.team,
        });
      }
      await this.persistAndBroadcastGameState(game, undefined, effects);
    });
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean,
  ) {
    try {
      ws.close(code, "Bye.");
    } catch {
      /* Already closed */
    }
    await this.ctx.blockConcurrencyWhile(async () => {
      const playerId = ws.deserializeAttachment()?.playerId;
      if (!playerId) return;
      const stillConnected = this.ctx
        .getWebSockets()
        .some(
          (s) =>
            s !== ws &&
            s.readyState === 1 &&
            s.deserializeAttachment()?.playerId === playerId,
        );
      if (stillConnected) return;
      this.disconnected[playerId] = Date.now() + DISCONNECT_GRACE_MS;
      await this.persistAndBroadcastGameState(await this.getGameInstance());
    });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1011, "Connection error", false);
  }

  private effects(...cues: Cue[]): SharedEffect[] {
    const playAt = Date.now() + 300;
    return cues.map((cue, index) => ({
      ...(typeof cue === "string" ? { type: cue } : cue),
      id: nanoid(),
      playAt: playAt + index * 450,
    }));
  }

  /** Reactions are fire-and-forget: never stored, lightly rate-limited per player. */
  private broadcastReaction(sender: WebSocket, emoji: string) {
    const playerId = sender.deserializeAttachment()?.playerId;
    if (!this.findCachedPlayer(playerId)) return;
    const now = Date.now();
    if (now - (this.lastReactionAt.get(playerId) ?? 0) < REACTION_COOLDOWN_MS)
      return;
    this.lastReactionAt.set(playerId, now);
    this.sendToAll({ type: "reaction", id: nanoid(), playerId, emoji });
  }

  /** Only the active spymaster drafting a clue shows as thinking. */
  private relayTyping(sender: WebSocket, typing: boolean) {
    const player = this.findCachedPlayer(sender.deserializeAttachment()?.playerId);
    const turn = this.game?.getGameState().turn;
    if (!player || player.role !== "spymaster" || player.team !== turn?.team || turn.hint) return;
    this.sendToAll({ type: "typing", playerId: player.id, typing }, sender);
  }

  /** Signals use the cached game only; if it isn't loaded, dropping a signal is harmless. */
  private findCachedPlayer(playerId: string | undefined) {
    return this.game?.getGameState().players.find((p) => p.id === playerId);
  }

  private sendToAll(event: object, exclude?: WebSocket) {
    const message = JSON.stringify(event);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude || ws.readyState !== 1) continue;
      try {
        ws.send(message);
      } catch {
        /* Client already gone */
      }
    }
  }

  /** Marks only live for the turn they were made in and only on face-down cards. */
  private currentMarks(game: Codenames): StoredMark[] {
    const { turn, board, players } = game.getGameState();
    if (!turn || game.getGameResult()) return [];
    return this.marks.filter(
      (mark) =>
        mark.turnUntil === +turn.until &&
        board.some((card) => card.word === mark.word && !card.revealed) &&
        players.some((player) => player.id === mark.playerId),
    );
  }

  private hasConnectedPlayers(): boolean {
    return this.ctx.getWebSockets().some((ws) => ws.readyState === 1);
  }

  private activeRound(): SessionRound | undefined {
    const round = this.sessionHistory.rounds.at(-1);
    return round?.status === "active" ? round : undefined;
  }

  private startRound(game: Codenames): void {
    // Each successful start has its own immutable roster snapshot and event log.
    const previous = this.activeRound();
    if (previous) {
      previous.status = "aborted";
      previous.endedAt = Date.now();
    }
    this.sessionHistory.rounds.push({
      id: nanoid(),
      startedAt: Date.now(),
      status: "active",
      wordPack: this.selectedWordPack,
      teamCount: this.selectedTeamCount,
      players: structuredClone(game.getGameState().players),
      events: [],
    });
    this.sessionHistory.rounds =
      this.sessionHistory.rounds.slice(-MAX_SESSION_ROUNDS);
  }

  private recordEvent(event: SessionEvent): void {
    const round = this.activeRound();
    if (!round) return;
    round.events.push(event);
    round.events = round.events.slice(-MAX_ROUND_EVENTS);
  }

  private finalizeRound(game: Codenames): void {
    const round = this.activeRound();
    if (!round) return;
    const result = game.getGameResult();
    if (result) {
      round.status = "completed";
      round.result = result;
      round.endedAt = Date.now();
    } else if (!game.getGameState().turn) {
      round.status = "aborted";
      round.endedAt = Date.now();
    }
  }

  private trimHistory(): void {
    const size = () =>
      new TextEncoder().encode(JSON.stringify(this.sessionHistory)).byteLength;
    if (size() <= MAX_HISTORY_BYTES) return;
    // Binary search avoids repeatedly serializing every item in an oversized history.
    const retain = (
      minimum: number,
      maximum: number,
      select: (count: number) => void,
    ) => {
      let low = minimum;
      let high = maximum;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        select(middle);
        if (size() <= MAX_HISTORY_BYTES) low = middle;
        else high = middle - 1;
      }
      select(low);
    };
    const rounds = this.sessionHistory.rounds;
    retain(1, rounds.length, (count) => {
      this.sessionHistory.rounds = rounds.slice(-count);
    });
    const latest = this.sessionHistory.rounds[0];
    if (latest && size() > MAX_HISTORY_BYTES) {
      const events = latest.events;
      retain(0, events.length, (count) => {
        latest.events = count ? events.slice(-count) : [];
      });
    }
    // Preserve the round itself even for unusually large rooms, and disclose partial snapshots.
    if (latest && size() > MAX_HISTORY_BYTES) {
      const players = latest.players;
      const alreadyOmitted = latest.playersOmitted ?? 0;
      retain(0, players.length, (count) => {
        latest.players = players.slice(0, count);
        latest.playersOmitted = alreadyOmitted + players.length - count;
      });
    }
  }

  private async deleteExpiredRoom(): Promise<boolean> {
    if (
      this.roomExpiresAt === undefined ||
      this.roomExpiresAt > Date.now() ||
      this.hasConnectedPlayers()
    )
      return false;
    // Explicitly delete the alarm as well for compatibility with older runtimes.
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
    this.roomExpiresAt = undefined;
    this.disconnected = {};
    this.selectedWordPack = "classic";
    this.selectedTeamCount = 2;
    this.customWords = [];
    this.sessionHistory = { rounds: [], awardSeed: crypto.randomUUID() };
    // In-memory caches must not resurrect the deleted room.
    this.game = undefined;
    this.marks = [];
    this.shuffleAt = undefined;
    this.lastReactionAt.clear();
    return true;
  }

  private async scheduleAlarm(game: Codenames) {
    const deadlines = Object.values(this.disconnected);
    if (this.roomExpiresAt !== undefined) deadlines.push(this.roomExpiresAt);
    if (this.shuffleAt !== undefined) deadlines.push(this.shuffleAt);
    const turn = game.getGameState().turn;
    if (turn && !game.getGameResult()) deadlines.push(+turn.until);
    if (deadlines.length)
      await this.ctx.storage.setAlarm(
        Math.max(Date.now() + 1, Math.min(...deadlines)),
      );
    else await this.ctx.storage.deleteAlarm();
  }

  private async persistAndBroadcastGameState(
    game: Codenames,
    exclude?: WebSocket,
    effects: SharedEffect[] = [],
  ): Promise<void> {
    const gameState = game.getGameState();
    this.marks = this.currentMarks(game);
    this.finalizeRound(game);
    this.trimHistory();
    if (this.hasConnectedPlayers()) this.roomExpiresAt = undefined;
    else this.roomExpiresAt ??= Date.now() + this.roomIdleTtlMs;
    await this.ctx.storage.put({
      [MARKS]: this.marks,
      [ROOM_EXPIRES_AT]: this.roomExpiresAt ?? null,
      [GAME_STATE]: JSON.stringify(gameState),
      [ROOM_SETTINGS]: {
        wordPack: this.selectedWordPack,
        teamCount: this.selectedTeamCount,
        customWords: this.customWords,
      },
      [DISCONNECTED]: this.disconnected,
      [SHUFFLE_AT]: this.shuffleAt ?? null,
      [SESSION_HISTORY]: this.sessionHistory,
    });
    await this.scheduleAlarm(game);

    const websockets = this.ctx.getWebSockets();
    const promises = websockets
      .filter(
        (websocket) => websocket !== exclude && websocket.readyState === 1,
      )
      .map((ws) => {
        const attachment = ws.deserializeAttachment();
        const playerId = attachment?.playerId;
        const isSpymaster =
          gameState.players.find((player) => player.id === playerId)?.role ===
          "spymaster";
        const isGameOver = game.getGameResult() !== undefined;

        const censoredGameBoard: WordCard[] = gameState.board.map((card) => ({
          ...card,
          isAssassin:
            !!card.revealed || isSpymaster || isGameOver
              ? card.isAssassin
              : undefined,
          team:
            !!card.revealed || isSpymaster || isGameOver
              ? card.team
              : undefined,
        }));

        const gameStateForClient: GameStateForClient = {
          ...gameState,
          board: censoredGameBoard,
          playerId,
          gameCanStart: game.isReadyToStartGame(),
          remainingWordsByTeam: Array.from(
            game.getRemainingWordsByTeam().values(),
          ),
          gameResult: game.getGameResult(),
          wordPack: this.selectedWordPack,
          teamCount: this.selectedTeamCount,
          customWords: this.customWords,
          serverTime: Date.now(),
          shuffleAt: this.shuffleAt,
          effects,
          marks: this.marks.map(({ word, playerId }) => ({ word, playerId })),
          turnSeconds: defaultParameters.turnDurationSeconds,
          sessionHistory: this.sessionHistory,
        };

        const gameStateUpdatedEvent = {
          type: "gameStateUpdated",
          gameState: gameStateForClient,
        };

        try {
          return ws.send(JSON.stringify(gameStateUpdatedEvent));
        } catch (error) {
          console.warn(`Failed to send to player ${playerId}:`, error);
          return undefined;
        }
      });

    await Promise.all(promises);
  }

  private async handleCommand(command: Command, ws: WebSocket): Promise<void> {
    const { playerId } = ws.deserializeAttachment();
    const game = await this.getGameInstance();

    const player = game.getGameState().players.find((p) => p.id === playerId);
    if (!player) {
      throw new GameError("Player not found in game");
    }

    console.info(`${player.name}: ${JSON.stringify(command)}`);

    switch (command.type) {
      case "setProfile": {
        game.addOrUpdatePlayer({
          ...player,
          name: command.name,
          animal: command.animal,
        });
        await this.persistAndBroadcastGameState(game);
        break;
      }
      case "shuffleTeams": {
        if (game.getGameState().turn)
          throw new GameError("End the game before shuffling teams");
        // Debounced: the running countdown already promises a shuffle.
        if (this.shuffleAt !== undefined) break;
        this.shuffleAt = Date.now() + SHUFFLE_COUNTDOWN_MS;
        await this.persistAndBroadcastGameState(game);
        break;
      }
      case "setCustomWords": {
        if (game.getGameState().turn)
          throw new GameError("Word lists can only change in the lobby");
        this.customWords = command.words;
        this.selectedWordPack = "custom";
        await this.persistAndBroadcastGameState(game);
        break;
      }
      case "randomizeName": {
        game.addOrUpdatePlayer({
          ...player,
          id: playerId,
          name: randomAnimalEmoji().split(" ").slice(1).join(" "),
        });
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "promoteToSpymaster": {
        if (game.getGameState().turn && !game.getGameResult())
          throw new GameError("Roles can only change before or after a game");
        const newSpymaster = game
          .getGameState()
          .players.find((p) => p.id === command.playerId);
        if (!newSpymaster) {
          throw new GameError("Player to promote not found");
        }
        game.addOrUpdatePlayer({ ...newSpymaster, role: "spymaster" });
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "startGame": {
        if (this.shuffleAt !== undefined)
          throw new GameError("Wait for the shuffle to finish");
        if (game.isReadyToStartGame()) {
          const pack =
            this.selectedWordPack === "custom"
              ? this.customWords
              : (wordPacks[this.selectedWordPack as BuiltInWordPackId] ??
                classic);
          if (pack.length < 25)
            throw new GameError("Add at least 25 custom words");
          game.setWords(pack);
          game.startGame();
          this.startRound(game);
          await this.persistAndBroadcastGameState(
            game,
            undefined,
            this.effects({
              type: "gameStart",
              team: game.getGameState().turn!.team,
            }),
          );
        }
        break;
      }

      case "giveHint": {
        if (player.team !== game.getGameState().turn?.team) {
          throw new GameError("Not player's turn");
        }
        if (player.role !== "spymaster") {
          throw new GameError("Not spymaster");
        }
        game.giveHint({ hint: command.hint, count: command.count });
        const turn = game.getGameState().turn!;
        this.recordEvent({
          type: "hint",
          timestamp: Date.now(),
          team: turn.team,
          hint: turn.hint!.hint,
          count: turn.hint!.count,
          spymaster: {
            id: player.id,
            name: player.name,
            animal: player.animal,
          },
        });
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "revealWord": {
        if (player.team !== game.getGameState().turn?.team) {
          throw new GameError("Not player's turn");
        }
        if (player.role === "spymaster") {
          throw new GameError("Spymaster cannot reveal words");
        }
        // Attribute guesses to the player who gave this clue, even after role reassignment.
        const currentTurn = game.getGameState().turn!;
        const hintEvent = this.activeRound()?.events.findLast(
          (event) => event.type === "hint" && event.team === currentTurn.team,
        );
        const spymaster =
          hintEvent?.type === "hint" &&
          hintEvent.hint === currentTurn.hint?.hint &&
          hintEvent.count === currentTurn.hint?.count
            ? hintEvent.spymaster
            : undefined;
        const guessingTeam = player.team;
        game.revealWord(command.word);
        const card = game
          .getGameState()
          .board.find((c) => c.word === command.word)!;
        const result = game.getGameResult();
        this.recordEvent({
          type: "guess",
          timestamp: Date.now(),
          team: card.revealed!.byTeam,
          word: card.word,
          outcome: card.isAssassin
            ? "assassin"
            : card.team === card.revealed!.byTeam
              ? "correct"
              : card.team === undefined
                ? "neutral"
                : "opponent",
          spymaster: spymaster ? structuredClone(spymaster) : undefined,
        });
        const type = card.isAssassin
          ? "assassinReveal"
          : card.team === guessingTeam
            ? "correctGuess"
            : "wrongGuess";
        const cues: Cue[] = [{ type, team: guessingTeam, word: card.word }];
        if (type === "correctGuess" && game.isCurrentClueComplete())
          cues.push({ type: "perfectClue", team: guessingTeam });
        if (result?.winningTeam !== undefined)
          cues.push({ type: "gameWin", team: result.winningTeam });
        const nextTeam = game.getGameState().turn?.team;
        if (!result && nextTeam !== undefined && nextTeam !== guessingTeam)
          cues.push({ type: "turnChange", team: nextTeam });
        await this.persistAndBroadcastGameState(
          game,
          undefined,
          this.effects(...cues),
        );

        break;
      }

      case "endTurn": {
        if (player.team !== game.getGameState().turn?.team) {
          throw new GameError("Not player's turn");
        }
        game.advanceTurn();
        await this.persistAndBroadcastGameState(
          game,
          undefined,
          this.effects({
            type: "turnChange",
            team: game.getGameState().turn!.team,
          }),
        );
        break;
      }

      case "endGame": {
        game.endGame();
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "setWordPack": {
        if (game.getGameState().turn)
          throw new GameError("Word packs can only change in the lobby");
        if (command.wordPack === "custom" && this.customWords.length < 25)
          throw new GameError("Save a custom list first");
        this.selectedWordPack = command.wordPack;
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "setTeamCount": {
        game.setTeamCount(command.teamCount);
        this.selectedTeamCount = command.teamCount;
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "markCard": {
        const { turn, board } = game.getGameState();
        if (!turn?.hint || game.getGameResult())
          throw new GameError("Cards can only be marked while guessing");
        if (player.team !== turn.team || player.role !== "operative")
          throw new GameError("Only guessing operatives can mark cards");
        if (!board.some((card) => card.word === command.word && !card.revealed))
          throw new GameError("Card cannot be marked");
        const marks = this.currentMarks(game);
        const existing = marks.findIndex(
          (mark) => mark.word === command.word && mark.playerId === playerId,
        );
        if (existing >= 0) marks.splice(existing, 1);
        else
          marks.push({ word: command.word, playerId, turnUntil: +turn.until });
        this.marks = marks;
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "typing":
      case "react":
        break;

      default:
        throw new GameError("Unknown command type. ¯\_(ツ)_/¯");
    }
  }
}
