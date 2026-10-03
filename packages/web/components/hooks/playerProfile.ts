import { animalSchema, Animal } from "schema";

export type PlayerProfile = { name: string; animal: Animal };
const PROFILE_KEY = "codenames:profile";
export const DEFAULT_PROFILE: PlayerProfile = { name: "", animal: "🦊" };

export function readProfile(): PlayerProfile {
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
  return DEFAULT_PROFILE;
}

export function saveProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* Keep playing without storage. */
  }
}

export function roomPlayerId(room: string): string {
  const key = `codenames:playerId:${room}`;
  try {
    const existing = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (existing) {
      localStorage.setItem(key, existing);
      return existing;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
