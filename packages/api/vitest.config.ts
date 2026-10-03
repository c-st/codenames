import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [
    {
      name: "cloudflare-workers-test-runtime",
      resolveId(id) {
        if (id === "cloudflare:workers")
          return "\0cloudflare-workers-test-runtime";
      },
      load(id) {
        if (id === "\0cloudflare-workers-test-runtime")
          return "export class DurableObject {}";
      },
    },
  ],
  test: {
    environment: "node",
    globals: true,
  },
});
