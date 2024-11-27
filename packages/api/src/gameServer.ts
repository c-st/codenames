import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from "uuid";
import { commandSchema, GameState, gameStateSchema } from "schema";
import { Env } from "./worker";
import { Codenames } from "game";

const GAME_STATE = "gameState";

const initialGameState: GameState = { players: [], board: [], turn: undefined };

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

      this.persistAndBroadcastGameState(game.getGameState());
    });
  }

  async getGameInstance(): Promise<Codenames> {
    try {
      let gameState: GameState;
      const state = await this.ctx.storage.get<string>(GAME_STATE);
      if (state) {
        gameState = gameStateSchema.parse(JSON.parse(state));
      } else {
        gameState = initialGameState;
      }
      return new Codenames(gameState ?? initialGameState, [], () => {});
    } catch (error) {
      console.error("Error initializing game state:", error);
      return new Codenames(initialGameState, [], () => {});
    }
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
    const playerId = uuidv4();
    server.serializeAttachment({
      ...server.deserializeAttachment(),
      playerId,
    });

    // Join game
    game.addOrUpdatePlayer({
      id: playerId,
      name: "Test",
      role: "operative",
      team: 0,
    });

    await this.persistAndBroadcastGameState(game.getGameState());

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    const { playerId } = ws.deserializeAttachment();

    // Parse JSON
    let parsedCommand;
    try {
      parsedCommand = commandSchema.parse(JSON.parse(message.toString()));
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return;
    }

    //
    console.log(await this.ctx.storage.getAlarm());
    await this.ctx.storage.setAlarm(Date.now() + 1000 * 60);

    // Handle command
    const command = parsedCommand;
    if (command.type === "resetGame") {
      await this.ctx.storage.delete(GAME_STATE);
      const game = new Codenames(initialGameState, [], () => {});
      await this.persistAndBroadcastGameState(game.getGameState());
      await ws.close();
    } else if (command.type === "hello") {
      console.log("Hello from player", playerId);
    }
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
    await this.persistAndBroadcastGameState(game.getGameState(), ws);
  }

  async broadcastMessage(message: string, exclude?: WebSocket): Promise<void> {
    const websockets = this.ctx.getWebSockets();
    // TODO: remove word type for players who are not spymasters
    const promises = websockets
      .filter((websocket) => websocket !== exclude)
      .map((ws) => ws.send(message));

    await Promise.all(promises);
  }

  async persistAndBroadcastGameState(
    gameState: GameState,
    exclude?: WebSocket
  ): Promise<void> {
    await this.ctx.storage.put(GAME_STATE, JSON.stringify(gameState));
    await this.broadcastMessage(JSON.stringify(gameState), exclude);
  }

  async alarm() {
    console.log("Alarm triggered");
  }
  // TODO: Callback for alarm schedule
}
