import { animalSchema, Animal } from "schema";

export type PlayerProfile = { name: string; animal: Animal };
const PROFILE_KEY = "codenames:profile";

/** The saved profile, or undefined on a browser that never saved one. */
export function readProfile(): PlayerProfile | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
    if (
      typeof value?.name === "string" &&
      value.name.trim().length <= 50 &&
      animalSchema.safeParse(value.animal).success
    ) {
      return { name: value.name.trim(), animal: value.animal };
    }
  } catch {
    /* Browser storage may be unavailable. */
  }
  return undefined;
}

let firstVisit: boolean | undefined;
/**
 * Whether this browser had no saved profile when the page loaded. Remembered for the
 * page's lifetime, because joining a room saves the server-assigned profile right away.
 */
export function isFirstVisit(): boolean {
  if (typeof window === "undefined") return false;
  firstVisit ??= readProfile() === undefined;
  return firstVisit;
}

export function saveProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* Keep playing without storage. */
  }
}

/**
 * Private per-room reconnect token. The server derives the public player id from it.
 * Values under the old `codenames:playerId:` key were broadcast to the room, so they are never reused.
 */
export function roomReconnectToken(room: string): string {
  const key = `codenames:token:${room}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
