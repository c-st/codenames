import { randomAnimalAlliteration } from "words";
import { CodenamesGame } from "./gameServer";

export interface Env {
  CODENAMES: DurableObjectNamespace<CodenamesGame>;
  WORKER_ENV: string | undefined;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const sessionName = url.pathname.split("/").at(1);

    const headers =
      env.WORKER_ENV === "local"
        ? { "Access-Control-Allow-Origin": "http://localhost:3000" }
        : { "Access-Control-Allow-Origin": "https://codenam.es" };

    if (!sessionName) {
      // Redirect to a random session
      const redirectUrl = new URL(url.origin);
      const randomSessionName = randomAnimalAlliteration();
      redirectUrl.pathname = `/${randomSessionName}`;

      // Redirect
      return new Response(null, {
        status: 302,
        headers: {
          ...headers,
          Location: redirectUrl.toString(),
        },
      });
    }

    // Ensure upgrade header is present
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected websocket upgrade.", {
        status: 426,
        headers,
      });
    }

    // DurableObject instance
    const id = env.CODENAMES.idFromName(sessionName);
    const obj = env.CODENAMES.get(id);

    return obj.fetch(request);
  },
};

export { CodenamesGame };
