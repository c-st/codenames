import { DurableObject } from "cloudflare:workers";

export class CodenamesGame extends DurableObject {
  async fetch(_request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(_ws: WebSocket, message: ArrayBuffer | string) {
    await this.incrementValue();
    const currentValue = await this.getValue();
    const memberCount = this.ctx.getWebSockets().length;
    await this.broadcastMessage(
      `> ${message} (${currentValue}, ${memberCount})`
    );
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

  async incrementValue() {
    let value = (await this.ctx.storage.get<number>("value")) || 0;
    value++;
    await this.ctx.storage.put("value", value);
  }

  async getValue(): Promise<number> {
    const value = (await this.ctx.storage.get<number>("value")) || 0;
    return value;
  }
}
