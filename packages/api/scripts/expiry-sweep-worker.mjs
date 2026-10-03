// Uploaded temporarily by sweep-rooms.mjs, then deleted in its finally block.
export default {
  async fetch(request, env) {
    if (
      !env.SWEEP_TOKEN ||
      !Number.isFinite(Number(env.EXPIRES_AT)) ||
      Date.now() > Number(env.EXPIRES_AT) ||
      request.headers.get("Authorization") !== `Bearer ${env.SWEEP_TOKEN}`
    )
      return new Response("Not found", { status: 404 });
    if (request.method !== "POST") return new Response(null, { status: 405 });
    let ids;
    try {
      ids = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (
      !Array.isArray(ids) ||
      ids.length > 20 ||
      !ids.every((id) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id))
    )
      return new Response("Invalid object IDs", { status: 400 });
    const results = [];
    for (let start = 0; start < ids.length; start += 5) {
      results.push(
        ...(await Promise.all(
          ids.slice(start, start + 5).map(async (id) => {
            try {
              const object = env.CODENAMES.get(env.CODENAMES.idFromString(id));
              const result = await object.enrollRoomExpiry();
              return { id, ...result };
            } catch {
              return { id, status: "failed" };
            }
          }),
        )),
      );
    }
    return Response.json(results);
  },
};
