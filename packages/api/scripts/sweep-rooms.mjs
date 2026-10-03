import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
const wrangler = join(apiDirectory, "node_modules/.bin/wrangler");

async function authToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  // Let the installed Wrangler refresh its own OAuth credentials first.
  try {
    execFileSync(wrangler, ["whoami"], {
      cwd: apiDirectory,
      stdio: "ignore",
      timeout: 60_000,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
  } catch {
    throw new Error(
      "Cloudflare login required: pnpm --filter api exec wrangler login",
    );
  }
  // Wrangler 3's legacy and XDG auth locations; token stays in memory only.
  const paths = [
    join(homedir(), ".wrangler/config/default.toml"),
    join(
      process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
      ".wrangler/config/default.toml",
    ),
    join(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
  ];
  for (const path of paths) {
    try {
      const config = await readFile(path, "utf8");
      const token = config.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1];
      if (token) return token;
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error("Could not read Wrangler login credentials.");
    }
  }
  throw new Error(
    "Wrangler credentials not found. Set CLOUDFLARE_API_TOKEN or log in with this project's Wrangler.",
  );
}

export async function main({ apply = false } = {}) {
  const token = await authToken();
  async function api(path, options = {}) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4${path}`,
      {
        ...options,
        headers: { Authorization: `Bearer ${token}`, ...options.headers },
        signal: AbortSignal.timeout(30_000),
      },
    );
    const body = await response.json();
    if (!response.ok || !body.success) {
      // Never echo request credentials, worker source, or upstream error bodies.
      throw new Error(
        `Cloudflare API failed (${response.status}) at ${path.split("?")[0]}. Check account permissions.`,
      );
    }
    return body;
  }
  let account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!account) {
    const { result } = await api("/accounts?per_page=50");
    if (result.length !== 1)
      throw new Error(
        "Set CLOUDFLARE_ACCOUNT_ID to choose the production account.",
      );
    account = result[0].id;
  }
  if (!/^[a-f0-9]{32}$/.test(account))
    throw new Error("Invalid CLOUDFLARE_ACCOUNT_ID.");
  const base = `/accounts/${account}/workers`;
  const namespaces = [];
  for (let page = 1; ; page++) {
    const body = await api(
      `${base}/durable_objects/namespaces?per_page=100&page=${page}`,
    );
    namespaces.push(...body.result);
    if (page >= (body.result_info?.total_pages ?? 1)) break;
  }
  const matches = namespaces.filter(
    (item) => item.script === "codenames-api" && item.class === "CodenamesGame",
  );
  if (matches.length !== 1)
    throw new Error(
      "Expected exactly one production codenames-api/CodenamesGame namespace; refusing to guess.",
    );
  const namespace = matches[0];
  const ids = new Set();
  const cursors = new Set();
  let cursor;
  do {
    const params = new URLSearchParams({ limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const body = await api(
      `${base}/durable_objects/namespaces/${namespace.id}/objects?${params}`,
    );
    for (const object of body.result) {
      if (object.hasStoredData === true) {
        if (!/^[a-f0-9]{64}$/.test(object.id))
          throw new Error("Invalid object ID in namespace listing.");
        ids.add(object.id);
      }
    }
    cursor = body.result_info?.cursor;
    if (cursor && cursors.has(cursor))
      throw new Error(
        "Namespace listing repeated a cursor; refusing incomplete sweep.",
      );
    if (cursor) cursors.add(cursor);
  } while (cursor);
  console.log(
    `Production namespace ${namespace.id}: ${ids.size} rooms with stored data.`,
  );
  if (!apply || ids.size === 0) {
    console.log(
      "Preview only. No rooms were awakened or changed. Use --apply after deploying the current API.",
    );
    return;
  }

  const { result: subdomain } = await api(`${base}/subdomain`);
  if (!/^[a-z0-9-]+$/.test(subdomain.subdomain))
    throw new Error(
      "A workers.dev account subdomain is required for the temporary sweep worker.",
    );
  const workerName = `codenames-expiry-sweep-${randomBytes(6).toString("hex")}`;
  const secret = randomBytes(32).toString("hex");
  const scriptPath = `${base}/scripts/${workerName}`;
  const form = new FormData();
  form.set(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          main_module: "sweep.mjs",
          compatibility_date: "2024-11-06",
          bindings: [
            {
              type: "durable_object_namespace",
              name: "CODENAMES",
              class_name: "CodenamesGame",
              script_name: "codenames-api",
            },
            { type: "secret_text", name: "SWEEP_TOKEN", text: secret },
            {
              type: "plain_text",
              name: "EXPIRES_AT",
              text: String(Date.now() + 60 * 60 * 1000),
            },
          ],
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.set(
    "sweep.mjs",
    new Blob(
      [
        await readFile(
          new URL("expiry-sweep-worker.mjs", import.meta.url),
          "utf8",
        ),
      ],
      { type: "application/javascript+module" },
    ),
    "sweep.mjs",
  );
  const totals = { idle: 0, active: 0, empty: 0, failed: 0 };
  console.log(`Temporary maintenance Worker: ${workerName}`);
  // Even a partially failed upload is cleaned up. Names are unique per run.
  try {
    await api(scriptPath, { method: "PUT", body: form });
    await api(`${scriptPath}/subdomain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, previews_enabled: false }),
    });
    const list = [...ids];
    for (let start = 0; start < list.length; start += 20) {
      const batch = list.slice(start, start + 20);
      let response;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(
            `https://${workerName}.${subdomain.subdomain}.workers.dev`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${secret}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(batch),
              signal: AbortSignal.timeout(30_000),
            },
          );
          if (response.ok || ![404, 502, 503, 504].includes(response.status))
            break;
        } catch {
          response = undefined;
        }
        if (attempt < 2)
          await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
      if (!response)
        throw new Error("Maintenance worker unavailable; safe to rerun.");
      if (!response.ok)
        throw new Error(
          `Maintenance request failed (${response.status}); safe to rerun.`,
        );
      const results = await response.json();
      if (
        !Array.isArray(results) ||
        results.length !== batch.length ||
        results.some(
          (item, index) => item.id !== batch[index] || !(item.status in totals),
        )
      )
        throw new Error(
          "Unexpected maintenance response; refusing to report an incomplete sweep.",
        );
      for (const item of results) totals[item.status]++;
      console.log(
        `Processed ${start + batch.length}/${list.length}: ${JSON.stringify(totals)}`,
      );
      if (totals.failed)
        throw new Error(
          "Some rooms could not be enrolled. Check that the current API is deployed; safe to rerun.",
        );
    }
    console.log(
      "Sweep complete. Idle rooms retain existing deadlines or get two weeks from enrollment; live rooms stay active.",
    );
  } finally {
    try {
      await api(scriptPath, { method: "DELETE" });
      console.log("Temporary maintenance worker removed.");
    } catch {
      throw new Error(
        `Cleanup could not be confirmed. Delete temporary Worker ${workerName} in Cloudflare. Its endpoint disables itself after one hour.`,
      );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !["--apply", "--dry-run"].includes(arg)) ||
    (args.includes("--apply") && args.includes("--dry-run"))
  ) {
    console.error("Usage: pnpm --filter api sweep:rooms [--dry-run | --apply]");
    process.exitCode = 1;
  } else
    main({ apply: args.includes("--apply") }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
