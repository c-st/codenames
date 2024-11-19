import { DurableObject } from "cloudflare:workers";

export class Counter extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    await this.incrementValue();
    const currentValue = await this.getValue();

    ws.send(
      `[Durable Object] message: ${message}, connections: ${
        this.ctx.getWebSockets().length
      }, currentValue: ${currentValue}`
    );

    await this.broadcastMessage("Current value is now: " + currentValue);
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    ws.close(code, "Durable Object is closing WebSocket");
  }

  async broadcastMessage(message: string) {
    const websockets = this.ctx.getWebSockets();
    const promises = websockets.map((ws) => ws.send(message));
    await Promise.all(promises);
  }

  // Counter logic
  async incrementValue() {
    let value = (await this.ctx.storage.get<number>("value")) || 0;
    await this.ctx.storage.put("value", value + 1);
  }

  async getValue(): Promise<number> {
    const value = (await this.ctx.storage.get<number>("value")) || 0;
    return value;
  }
}
