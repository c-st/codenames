import { randomUUID } from "node:crypto";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import type { GameStateForClient, SharedEffect } from "schema";

export const roomUrl = () => `/?session=e2e-${randomUUID()}`;

// Observe the real server frames alongside UI assertions. This catches duplicate
// identities and mismatched team/board state that a screenshot cannot detect.
export function watchRoom(page: Page) {
  let latest: GameStateForClient | undefined;
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      try {
        const event = JSON.parse(payload.toString());
        if (event.type === "gameStateUpdated") latest = event.gameState;
      } catch {
        // Only game-state JSON frames matter to these assertions.
      }
    });
  });
  return () => latest;
}

/** Every shared cue a page has been sent, in order. */
export function watchEffects(page: Page) {
  const effects: SharedEffect[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      try {
        const event = JSON.parse(payload.toString());
        if (event.type === "gameStateUpdated")
          effects.push(...(event.gameState.effects ?? []));
      } catch {
        // Ignore non-JSON frames.
      }
    });
  });
  return effects;
}

/** Waits until the page has announced the latest cue of this type with its ribbon. */
export async function expectAnnounced(
  page: Page,
  effects: SharedEffect[],
  type: SharedEffect["type"],
) {
  await expect
    .poll(() => effects.some((effect) => effect.type === type))
    .toBe(true);
  const cue = effects.filter((effect) => effect.type === type).at(-1)!;
  await expect(
    page.locator(`[data-last-banner-id="${cue.id}"]`),
  ).toBeAttached();
  return cue;
}

/** Every raw frame a page receives, for asserting what other players can see. */
export function recordFrames(page: Page) {
  const frames: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) =>
      frames.push(payload.toString()),
    );
  });
  return frames;
}

export async function saveProfile(page: Page, name: string) {
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(name) }),
  ).toHaveCount(1);
}

export type SoundStart = { frequency: number; wallTime: number };

/**
 * Replaces Web Audio with a silent fake that records every oscillator start. Tests check
 * which tones the game schedules and when, without depending on the host's audio stack
 * (a stuck audio service can stall a real AudioContext for many seconds). Like a real
 * browser, the fake starts suspended and only runs after the game resumes it on a gesture.
 */
export function recordSounds(context: BrowserContext) {
  return context.addInitScript(() => {
    const recorded = window as typeof window & { soundStarts: SoundStart[] };
    recorded.soundStarts = [];
    const param = () => ({
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
      linearRampToValueAtTime() {},
    });
    const node = () => ({ connect() {}, disconnect() {} });
    class FakeAudioContext {
      state: AudioContextState = "suspended";
      destination = node();
      private readonly createdAt = performance.now();
      get currentTime() {
        return (performance.now() - this.createdAt) / 1000;
      }
      resume() {
        this.state = "running";
        return Promise.resolve();
      }
      close() {
        this.state = "closed";
        return Promise.resolve();
      }
      createGain() {
        return { ...node(), gain: param() };
      }
      createOscillator() {
        const oscillator = {
          ...node(),
          type: "sine",
          frequency: param(),
          start: (when = 0) => {
            recorded.soundStarts.push({
              frequency: oscillator.frequency.value,
              wallTime:
                Date.now() + Math.max(0, when - this.currentTime) * 1000,
            });
          },
          stop() {},
        };
        return oscillator;
      }
    }
    Object.defineProperty(window, "AudioContext", {
      value: FakeAudioContext,
      configurable: true,
    });
  });
}

export const soundStarts = (page: Page) =>
  page.evaluate(
    () => (window as typeof window & { soundStarts: SoundStart[] }).soundStarts,
  );
