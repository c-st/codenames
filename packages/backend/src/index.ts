import { Counter } from "./counter";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const id = env.COUNTER.idFromName("A");
    const obj = env.COUNTER.get(id);
    return obj.fetch(request);
  },
};

export { Counter };
