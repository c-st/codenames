import { DurableObject } from "cloudflare:workers";
import { Codenames, GameState, gameStateSchema } from "game";
import { messageSchema } from "schema";

const initialGameState: GameState = { players: [], board: [] };

export class CodenamesGame extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionName = url.pathname.split("/").at(1);
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    const game = await this.loadGameInstance();

    server.send(JSON.stringify(game.getGameState()));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(_ws: WebSocket, message: ArrayBuffer | string) {
    const game = await this.loadGameInstance();

    console.log("Received message:", message);
    // Parse JSON
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.toString());
    } catch (error) {
      console.info("Failed to parse JSON:", error);
      return;
    }

    const messageParseResult = messageSchema.safeParse(parsedMessage);
    if (!messageParseResult.success) {
      console.info("Invalid message:", messageParseResult.error);
      return;
    }

    const gameMessage = messageParseResult.data;
    if (gameMessage.type?.type === "addPlayer") {
      game.addOrUpdatePlayer(gameMessage.type.player);
    } else if (gameMessage.type?.type === "removePlayer") {
      game.removePlayer(gameMessage.type.playerId);
    }

    await this.persistGameState(game.getGameState());
    await this.broadcastMessage(JSON.stringify(game.getGameState()));
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    ws.close(code, "Bye.");
  }

  async broadcastMessage(message: string) {
    const websockets = this.ctx.getWebSockets();
    const promises = websockets.map((ws) => ws.send(message));
    await Promise.all(promises);
  }

  async persistGameState(gameState: GameState) {
    await this.ctx.storage.put("gameState", JSON.stringify(gameState));
  }

  async loadGameInstance(): Promise<Codenames> {
    const state = await this.gameState();
    return new Codenames(state, [], () => {});
  }

  async gameState(): Promise<GameState> {
    const state = (await this.ctx.storage.get<string>("gameState")) || "{}";
    try {
      const parsedState = JSON.parse(state);
      const gameState = gameStateSchema.safeParse(parsedState);
      return gameState.success ? gameState.data : initialGameState;
    } catch (error) {
      console.error("Failed to load game state:", error);
    }
    return initialGameState;
  }

  // TODO: Callback for alarm schedule
}
