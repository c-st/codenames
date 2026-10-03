import { main } from "./sweep-rooms.mjs";

const account = "a".repeat(32);
const namespace = "b".repeat(32);
const ids = ["c".repeat(64), "d".repeat(64)];
const result = (value, info) =>
  Response.json({ success: true, result: value, result_info: info });

beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "private-test-token");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", account);
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function mockCloudflare({ roomFailure = false, wrongNamespace = false } = {}) {
  const calls = [];
  const fetchMock = vi.fn(async (url, options = {}) => {
    const address = new URL(url);
    const method = options.method ?? "GET";
    calls.push({ address, method, options });
    if (address.host.endsWith("workers.dev")) {
      const batch = JSON.parse(options.body);
      return Response.json(
        batch.map((id) => ({
          id,
          status: roomFailure ? "failed" : "idle",
          expiresAt: 123,
        })),
      );
    }
    if (address.pathname.endsWith("/durable_objects/namespaces"))
      return result(
        [
          {
            id: namespace,
            script: wrongNamespace ? "codenames-api-local" : "codenames-api",
            class: "CodenamesGame",
          },
        ],
        { total_pages: 1 },
      );
    if (address.pathname.endsWith("/objects")) {
      if (!address.searchParams.has("cursor"))
        return result(
          [
            { id: ids[0], hasStoredData: true },
            { id: "e".repeat(64), hasStoredData: false },
          ],
          { cursor: "second-page" },
        );
      return result([
        { id: ids[0], hasStoredData: true },
        { id: ids[1], hasStoredData: true },
      ]);
    }
    if (address.pathname.endsWith("/workers/subdomain"))
      return result({ subdomain: "test-account" });
    if (address.pathname.includes("/scripts/codenames-expiry-sweep-"))
      return result({});
    throw new Error("Unexpected fetch in test");
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

it("preview paginates and deduplicates stored rooms without waking them or creating a Worker", async () => {
  const calls = mockCloudflare();
  await main();
  expect(calls.every((call) => call.method === "GET")).toBe(true);
  expect(
    calls.filter((call) => call.address.pathname.endsWith("/objects")),
  ).toHaveLength(2);
  expect(console.log).toHaveBeenCalledWith(
    `Production namespace ${namespace}: 2 rooms with stored data.`,
  );
  expect(calls.some((call) => call.address.host.endsWith("workers.dev"))).toBe(
    false,
  );
});

it("refuses a local or ambiguous namespace before making mutations", async () => {
  const calls = mockCloudflare({ wrongNamespace: true });
  await expect(main({ apply: true })).rejects.toThrow("exactly one production");
  expect(calls.every((call) => call.method === "GET")).toBe(true);
});

it("uses only stored production IDs, secret bindings and guaranteed temporary Worker cleanup", async () => {
  const calls = mockCloudflare();
  await main({ apply: true });
  const upload = calls.find((call) => call.method === "PUT");
  const metadata = JSON.parse(await upload.options.body.get("metadata").text());
  expect(metadata.bindings[0]).toMatchObject({
    script_name: "codenames-api",
    class_name: "CodenamesGame",
  });
  expect(
    metadata.bindings.find((binding) => binding.name === "SWEEP_TOKEN").type,
  ).toBe("secret_text");
  const invocation = calls.find((call) =>
    call.address.host.endsWith("workers.dev"),
  );
  expect(JSON.parse(invocation.options.body)).toEqual(ids);
  expect(calls.at(-1).method).toBe("DELETE");
  expect(calls.at(-1).address.pathname).toBe(upload.address.pathname);
  expect(JSON.stringify(console.log.mock.calls)).not.toContain(
    "private-test-token",
  );
});

it("stops on failed room enrollment and still deletes the temporary Worker", async () => {
  const calls = mockCloudflare({ roomFailure: true });
  await expect(main({ apply: true })).rejects.toThrow(
    "Some rooms could not be enrolled",
  );
  expect(calls.at(-1).method).toBe("DELETE");
});
