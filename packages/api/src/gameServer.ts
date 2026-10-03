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
  sessionHistorySchema,
  SessionHistory,
  SessionRound,
  SessionEvent,
} from "schema";
import { Env } from "./worker";
import {
  Codenames,
  defaultParameters,
  GameError,
  initialGameState,
} from "game";
import {
  classic,
  movies,
  food,
  geography,
  science,
  tech,
  agile,
  design,
  startup,
  internet,
  randomAnimalEmoji,
} from "words";

const GAME_STATE = "gameState";
const DISCONNECT_GRACE_MS = 60_000;
const ROOM_SETTINGS = "roomSettings";
const DISCONNECTED = "disconnected";
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
    const candidateId = url.searchParams.get("playerId");
    const requestedPlayerId =
      candidateId && /^[a-zA-Z0-9_-]{21,64}$/.test(candidateId)
        ? candidateId
        : null;

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Restore state
    const game = await this.getGameInstance();
    const existingPlayers = game.getGameState().players;

    // Accept WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Determine playerId: reconnect as existing player or create new one
    let playerId: string;
    const canReconnect =
      requestedPlayerId &&
      existingPlayers.some((p) => p.id === requestedPlayerId);

    if (canReconnect) {
      playerId = requestedPlayerId;
    } else {
      playerId = requestedPlayerId ?? nanoid();
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

    // Catch expected rejections inside the concurrency block: an escaping error resets the object.
    await this.ctx.blockConcurrencyWhile(async () => {
      try {
        await this.handleCommand(parsedCommand, ws);
      } catch (error) {
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
      const turn = game.getGameState().turn;
      let effects: SharedEffect[] = [];
      if (turn && +turn.until <= now && !game.getGameResult()) {
        game.advanceTurn();
        effects = this.effects("turnChange");
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

  private effects(...types: SharedEffect["type"][]): SharedEffect[] {
    const playAt = Date.now() + 300;
    return types.map((type, index) => ({
      id: nanoid(),
      type,
      playAt: playAt + index * 450,
    }));
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
    return true;
  }

  private async scheduleAlarm(game: Codenames) {
    const deadlines = Object.values(this.disconnected);
    if (this.roomExpiresAt !== undefined) deadlines.push(this.roomExpiresAt);
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
    this.finalizeRound(game);
    this.trimHistory();
    if (this.hasConnectedPlayers()) this.roomExpiresAt = undefined;
    else this.roomExpiresAt ??= Date.now() + this.roomIdleTtlMs;
    await this.ctx.storage.put({
      [ROOM_EXPIRES_AT]: this.roomExpiresAt ?? null,
      [GAME_STATE]: JSON.stringify(gameState),
      [ROOM_SETTINGS]: {
        wordPack: this.selectedWordPack,
        teamCount: this.selectedTeamCount,
        customWords: this.customWords,
      },
      [DISCONNECTED]: this.disconnected,
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
          effects,
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
        game.shuffleTeams();
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
      case "setName": {
        game.addOrUpdatePlayer({
          ...player,
          id: playerId,
          name: command.name,
        });
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
        if (game.isReadyToStartGame()) {
          const wordPacks: Record<string, string[]> = {
            classic,
            movies,
            food,
            geography,
            science,
            tech,
            agile,
            design,
            startup,
            internet,
          };
          const pack =
            this.selectedWordPack === "custom"
              ? this.customWords
              : (wordPacks[this.selectedWordPack] ?? classic);
          if (pack.length < 25)
            throw new GameError("Add at least 25 custom words");
          game.setWords(pack);
          game.startGame();
          this.startRound(game);
          await this.persistAndBroadcastGameState(game);
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
        const cue = card.isAssassin
          ? "assassinReveal"
          : card.team === card.revealed?.byTeam
            ? "correctGuess"
            : "wrongGuess";
        await this.persistAndBroadcastGameState(
          game,
          undefined,
          this.effects(
            cue,
            ...(result?.winningTeam !== undefined ? ["gameWin" as const] : []),
          ),
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
          this.effects("turnChange"),
        );
        break;
      }

      case "endGame": {
        game.endGame();
        await this.ctx.storage.deleteAlarm();
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

      default:
        throw new GameError("Unknown command type. ¯\_(ツ)_/¯");
    }
  }
}
