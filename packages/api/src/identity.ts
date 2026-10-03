const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{21,64}$/;

export const isReconnectToken = (value: string | null): value is string =>
  !!value && TOKEN_PATTERN.test(value);

/**
 * Player ids are broadcast to every client, so they must not double as reconnect
 * credentials. Clients keep a private token; everyone else only sees its one-way hash.
 */
export async function publicPlayerId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`codenames-player:${token}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest).slice(0, 16)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
