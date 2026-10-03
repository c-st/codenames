import worker from "./expiry-sweep-worker.mjs";

const ids = ["a".repeat(64), "b".repeat(64)];
const request = (body, token = "test-secret") =>
  new Request("https://sweep.test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const environment = () => ({
  SWEEP_TOKEN: "test-secret",
  EXPIRES_AT: String(Date.now() + 60_000),
  CODENAMES: {
    idFromString: vi.fn((id) => id),
    get: vi.fn(() => ({
      enrollRoomExpiry: vi.fn(async () => ({ status: "idle", expiresAt: 123 })),
    })),
  },
});

it("authenticates and expires the temporary worker before touching rooms", async () => {
  const env = environment();
  expect((await worker.fetch(request(ids, "wrong"), env)).status).toBe(404);
  env.EXPIRES_AT = "0";
  expect((await worker.fetch(request(ids), env)).status).toBe(404);
  expect(env.CODENAMES.get).not.toHaveBeenCalled();
});

it("rejects invalid IDs and oversized batches without touching rooms", async () => {
  const env = environment();
  expect((await worker.fetch(request(["not-an-id"]), env)).status).toBe(400);
  expect(
    (await worker.fetch(request(Array(21).fill(ids[0])), env)).status,
  ).toBe(400);
  expect(env.CODENAMES.get).not.toHaveBeenCalled();
});

it("enrolls each ID and reports individual failures so partial sweeps are visible", async () => {
  const env = environment();
  env.CODENAMES.get.mockImplementationOnce(() => ({
    enrollRoomExpiry: async () => {
      throw new Error("Unavailable");
    },
  }));
  const response = await worker.fetch(request(ids), env);
  expect(await response.json()).toEqual([
    { id: ids[0], status: "failed" },
    { id: ids[1], status: "idle", expiresAt: 123 },
  ]);
  expect(env.CODENAMES.idFromString.mock.calls).toEqual(ids.map((id) => [id]));
});
