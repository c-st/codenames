import { CodenamesGame } from "./gameServer";

export interface Env {
  CODENAMES: DurableObjectNamespace<CodenamesGame>;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Extract session name
    const url = new URL(request.url);
    const sessionName = url.pathname.split("/").at(1);
    if (!sessionName) {
      // Redirect to a random session
      const redirectUrl = new URL(url.origin);
      const randomSessionName = "snazzy-squirrel"; // TODO: make this random
      redirectUrl.pathname = `/${randomSessionName}`;
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Ensure upgrade header
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected websocket upgrade.", {
        status: 426,
      });
    }

    const id = env.CODENAMES.idFromName(sessionName);
    const obj = env.CODENAMES.get(id);

    return obj.fetch(request);
  },
};

export { CodenamesGame };
