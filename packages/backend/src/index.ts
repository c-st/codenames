import { Counter } from "./counter";

export interface Env {
  COUNTER: DurableObjectNamespace<Counter>;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    console.log("worker.fetch", { request });
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Durable Object expected Upgrade: websocket", {
        status: 426,
      });
    }

    console.log("after update");
    const id = env.COUNTER.idFromName("A"); // hardcoded (should be game instance)
    const obj = env.COUNTER.get(id);

    console.log("Calling object", { obj, id });
    return obj.fetch(request);
  },
};

export { Counter };
