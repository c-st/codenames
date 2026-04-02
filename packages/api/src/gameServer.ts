import { DurableObject } from "cloudflare:workers";
import { nanoid } from "nanoid";
import {
  Command,
  commandSchema,
  GameState,
  GameStateForClient,
  gameStateSchema,
  WordCard,
} from "schema";
import { Env } from "./worker";
import {
  Codenames,
  defaultParameters,
  GameError,
  initialGameState,
} from "game";
import { classic, movies, food, geography, science, tech, agile, design, startup, internet, randomAnimalEmoji } from "words";

const GAME_STATE = "gameState";
const DISCONNECT_GRACE_MS = 15_000;

export class CodenamesGame extends DurableObject {
  /** Tracks pending removal timers for disconnected players */
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private selectedWordPack: string = "classic";
  private selectedTeamCount: number = 2;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Block incoming requests until stale player cleanup completes
    this.ctx.blockConcurrencyWhile(async () => {
      const game = await this.getGameInstance();
      const websockets = this.ctx.getWebSockets();
      const connectedPlayerIds = new Set(
        websockets.map((ws) => ws.deserializeAttachment()?.playerId)
      );

      const stalePlayerIds = game
        .getGameState()
        .players.filter((p) => !connectedPlayerIds.has(p.id))
        .map((p) => p.id);
      for (const id of stalePlayerIds) {
        game.removePlayer(id);
      }
      if (stalePlayerIds.length > 0) {
        await this.persistAndBroadcastGameState(game);
      }
    });
  }

  async getGameInstance(): Promise<Codenames> {
    const onScheduleCallAdvanceTurn = (date: Date) => {
      this.ctx.storage.setAlarm(date.getTime());
    };

    const state = await this.ctx.storage.get<string>(GAME_STATE);
    if (!state) {
      return new Codenames(
        initialGameState,
        classic,
        onScheduleCallAdvanceTurn,
        defaultParameters
      );
    }

    try {
      const gameState = gameStateSchema.parse(JSON.parse(state));
      return new Codenames(
        gameState,
        classic,
        onScheduleCallAdvanceTurn,
        defaultParameters
      );
    } catch (error) {
      console.error(
        "Corrupted game state, resetting. Parse error:",
        error,
        "Raw state (first 500 chars):",
        state.slice(0, 500)
      );
      // Clear the corrupted state so it doesn't persist
      await this.ctx.storage.delete(GAME_STATE);
      return new Codenames(
        initialGameState,
        classic,
        onScheduleCallAdvanceTurn,
        defaultParameters
      );
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const requestedPlayerId = url.searchParams.get("playerId");

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

      // Cancel pending disconnect removal if any
      const timer = this.disconnectTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectTimers.delete(playerId);
        console.info(`Player ${playerId} reconnected, cancelled removal`);
      }
    } else {
      playerId = nanoid();
      game.joinGame({ id: playerId, name: randomAnimalEmoji() });
    }

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
        ws.send(JSON.stringify({ type: "pong" }));
      } catch {
        // Client already gone
      }
      return;
    }

    // Handle command
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
  }

  async alarm() {
    const game = await this.getGameInstance();
    if (
      game.getGameResult() === undefined &&
      game.getGameState().players.length > 1
    ) {
      game.advanceTurn();
    }
    await this.persistAndBroadcastGameState(game);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    const attachment = ws.deserializeAttachment();
    const playerId = attachment?.playerId;

    try {
      ws.close(code, "Bye.");
    } catch {
      // Already closed
    }

    if (!playerId) return;

    // Grace period: wait before removing the player to allow reconnection
    this.disconnectTimers.set(
      playerId,
      setTimeout(async () => {
        this.disconnectTimers.delete(playerId);

        // Check if the player reconnected on a different socket
        const websockets = this.ctx.getWebSockets();
        const reconnected = websockets.some(
          (s) => s.deserializeAttachment()?.playerId === playerId
        );
        if (reconnected) return;

        const game = await this.getGameInstance();
        game.removePlayer(playerId);
        await this.persistAndBroadcastGameState(game);
        console.info(
          `Player ${playerId} removed after disconnect grace period`
        );
      }, DISCONNECT_GRACE_MS)
    );
  }

  private async persistAndBroadcastGameState(
    game: Codenames,
    exclude?: WebSocket
  ): Promise<void> {
    const gameState = game.getGameState();
    await this.ctx.storage.put(GAME_STATE, JSON.stringify(gameState));

    const websockets = this.ctx.getWebSockets();
    const promises = websockets
      .filter((websocket) => websocket !== exclude)
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
            game.getRemainingWordsByTeam().values()
          ),
          gameResult: game.getGameResult(),
          wordPack: this.selectedWordPack,
          teamCount: this.selectedTeamCount,
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
          name: randomAnimalEmoji(),
        });
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "promoteToSpymaster": {
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
            classic, movies, food, geography, science, tech, agile, design, startup, internet,
          };
          const pack = wordPacks[this.selectedWordPack] ?? classic;
          game.setWords(pack);
          game.setTeamCount(this.selectedTeamCount);
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
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "endTurn": {
        if (player.team !== game.getGameState().turn?.team) {
          throw new GameError("Not player's turn");
        }
        game.advanceTurn();
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "endGame": {
        game.endGame();
        await this.ctx.storage.deleteAlarm();
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "setWordPack": {
        this.selectedWordPack = command.wordPack;
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "setTeamCount": {
        this.selectedTeamCount = command.teamCount;
        await this.persistAndBroadcastGameState(game);
        break;
      }

      default:
        throw new GameError("Unknown command type. ¯\_(ツ)_/¯");
    }
  }
}
