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

type Cue = SharedEffect["type"] | Omit<SharedEffect, "id" | "playAt">;
type StoredMark = CardMark & { turnUntil: number };

export class CodenamesGame extends DurableObject {
  private disconnected: Record<string, number> = {};
  private selectedWordPack = "classic";
  private selectedTeamCount = 2;
  private customWords: string[] = [];
  // Cached between events; dropped after any failed command so storage stays the source of truth.
  private game: Codenames | undefined;
  private marks: StoredMark[] = [];
  private lastReactionAt = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
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
      this.disconnected =
        (await this.ctx.storage.get<Record<string, number>>(DISCONNECTED)) ??
        {};
      this.marks = (await this.ctx.storage.get<StoredMark[]>(MARKS)) ?? [];
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
    // One durable alarm serves both turn deadlines and reconnect grace periods.
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

  private async handleFetch(request: Request): Promise<Response> {
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

  private async scheduleAlarm(game: Codenames) {
    const deadlines = Object.values(this.disconnected);
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
    await this.ctx.storage.put({
      [MARKS]: this.marks,
      [GAME_STATE]: JSON.stringify(gameState),
      [ROOM_SETTINGS]: {
        wordPack: this.selectedWordPack,
        teamCount: this.selectedTeamCount,
        customWords: this.customWords,
      },
      [DISCONNECTED]: this.disconnected,
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
          marks: this.marks.map(({ word, playerId }) => ({ word, playerId })),
          turnSeconds: defaultParameters.turnDurationSeconds,
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
          const pack =
            this.selectedWordPack === "custom"
              ? this.customWords
              : (wordPacks[this.selectedWordPack as BuiltInWordPackId] ??
                classic);
          if (pack.length < 25)
            throw new GameError("Add at least 25 custom words");
          game.setWords(pack);
          game.startGame();
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
        const guessingTeam = player.team;
        game.revealWord(command.word, playerId);
        const card = game
          .getGameState()
          .board.find((c) => c.word === command.word)!;
        const result = game.getGameResult();
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
