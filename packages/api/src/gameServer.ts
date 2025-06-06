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
import { classic, randomAnimalEmoji } from "words";

const GAME_STATE = "gameState";

export class CodenamesGame extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Make sure that all players in the game are still connected
    this.getGameInstance().then((game) => {
      const websockets = this.ctx.getWebSockets();
      game.getGameState().players.forEach((player) => {
        if (
          !websockets.some(
            (ws) => ws.deserializeAttachment().playerId === player.id
          )
        ) {
          game.removePlayer(player.id);
        }
      });
      this.persistAndBroadcastGameState(game);
    });
  }

  async getGameInstance(): Promise<Codenames> {
    const onScheduleCallAdvanceTurn = (date: Date) => {
      this.ctx.storage.setAlarm(date.getTime());
    };

    try {
      let gameState: GameState;
      const state = await this.ctx.storage.get<string>(GAME_STATE);
      if (state) {
        gameState = gameStateSchema.parse(JSON.parse(state));
      } else {
        gameState = initialGameState;
      }
      return new Codenames(
        gameState,
        classic,
        onScheduleCallAdvanceTurn,
        defaultParameters
      );
    } catch (error) {
      console.error("Error initializing game state:", error);
    }
    return new Codenames(
      initialGameState,
      classic,
      onScheduleCallAdvanceTurn,
      defaultParameters
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    // const sessionName = url.pathname.split("/").at(1);
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Restore state
    const game = await this.getGameInstance();

    // Accept WebSocket connection
    this.ctx.acceptWebSocket(server);

    // Assign playerId
    const playerId = nanoid();
    server.serializeAttachment({
      ...server.deserializeAttachment(),
      playerId,
    });

    // Join game
    game.joinGame({ id: playerId, name: randomAnimalEmoji() });

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

    // Handle command
    try {
      const command = parsedCommand;
      await this.handleCommand(command, ws);
    } catch (error) {
      if (error instanceof GameError) {
        console.info("Command was rejected. Reason:", error.message);
        const commandRejectedEvent = {
          type: "commandRejected",
          reason: error.message,
        };
        ws.send(JSON.stringify(commandRejectedEvent));
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
    const { playerId } = ws.deserializeAttachment();
    ws.close(code, "Bye.");

    const game = await this.getGameInstance();
    game.removePlayer(playerId);
    await this.persistAndBroadcastGameState(game, ws);
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
        const { playerId } = ws.deserializeAttachment();
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
        };

        const gameStateUpdatedEvent = {
          type: "gameStateUpdated",
          gameState: gameStateForClient,
        };

        return ws.send(JSON.stringify(gameStateUpdatedEvent));
      });

    await Promise.all(promises);
  }

  private async handleCommand(command: Command, ws: WebSocket): Promise<void> {
    const { playerId } = ws.deserializeAttachment();
    const game = await this.getGameInstance();

    const player = game.getGameState().players.find((p) => p.id === playerId);
    if (!player) {
      console.error("Player not found:", playerId);
      return;
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

      case "promoteToSpymaster": {
        const newSpymaster = game
          .getGameState()
          .players.find((p) => p.id === command.playerId);
        if (!newSpymaster) {
          return;
        }
        game.addOrUpdatePlayer({ ...newSpymaster, role: "spymaster" });
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "startGame": {
        if (game.isReadyToStartGame()) {
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
          return;
        }
        if (player.role === "spymaster") {
          throw new GameError("Spymaster cannot reveal words");
          return;
        }
        game.revealWord(command.word);
        await this.persistAndBroadcastGameState(game);
        break;
      }

      case "endTurn": {
        if (player.team !== game.getGameState().turn?.team) {
          throw new GameError("Not player's turn");
          return;
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

      default:
        throw new GameError("Unknown command type. ¯\_(ツ)_/¯");
    }
  }
}
