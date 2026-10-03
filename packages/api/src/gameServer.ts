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
  randomAnimalEmoji,
  wordPacks,
  BuiltInWordPackId,
} from "words";

const GAME_STATE = "gameState";
const DISCONNECT_GRACE_MS = 60_000;
const ROOM_SETTINGS = "roomSettings";
const DISCONNECTED = "disconnected";

export class CodenamesGame extends DurableObject {
  private disconnected: Record<string, number> = {};
  private selectedWordPack = "classic";
  private selectedTeamCount = 2;
  private customWords: string[] = [];
  // Cached between events; dropped after any failed command so storage stays the source of truth.
  private game: Codenames | undefined;

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
    await this.ctx.storage.put({
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
        game.revealWord(command.word);
        const card = game
          .getGameState()
          .board.find((c) => c.word === command.word)!;
        const result = game.getGameResult();
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
