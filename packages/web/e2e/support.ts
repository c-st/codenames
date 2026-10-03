import { randomUUID } from "node:crypto";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import type { GameStateForClient, SharedEffect } from "schema";

export const roomUrl = () => `/?session=e2e-${randomUUID()}`;

// Observe the real server frames alongside UI assertions. This catches duplicate
// identities and mismatched team/board state that a screenshot cannot detect.
const transportDebug = new WeakMap<Page, string[]>();

export function watchRoom(page: Page) {
  const debug: string[] = [];
  transportDebug.set(page, debug);
  let latest: GameStateForClient | undefined;
  page.on("websocket", (socket) => {
    socket.on("framesent", ({ payload }) => {
      debug.push(`sent ${payload.toString()}`);
    });
    socket.on("framereceived", ({ payload }) => {
      try {
        const event = JSON.parse(payload.toString());
        if (event.type === "gameStateUpdated") {
          latest = event.gameState;
          debug.push(`players ${JSON.stringify(latest?.players)}`);
        }
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
  await page.bringToFront();
  await page.getByLabel("Your name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Save profile", exact: true })
    .click({ noWaitAfter: true });
  try {
    await expect(
      page.getByRole("button", { name: new RegExp(name) }),
    ).toHaveCount(1);
  } catch (error) {
    console.log("PROFILE DEBUG", name, transportDebug.get(page)?.slice(-8));
    console.log("PROFILE UI", await page.locator("body").innerText());
    throw error;
  }
}

export type SoundStart = { frequency: number; wallTime: number };

// A real Web Audio graph and clock with a silent sink make these tests independent
// of CI/headless machines' physical speakers while preserving gesture gating.
export async function installSilentAudio(
  context: BrowserContext,
  recordTones = false,
) {
  await context.addInitScript(
    ({ recordTones }) => {
      const recorded = window as typeof window & {
        soundStarts: { frequency: number; wallTime: number }[];
        audioContexts: AudioContext[];
      };
      recorded.soundStarts = [];
      recorded.audioContexts = [];
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        constructor(options?: AudioContextOptions) {
          super({
            ...options,
            sinkId: { type: "none" },
          } as AudioContextOptions);
          recorded.audioContexts.push(this);
        }
      };
      if (!recordTones) return;
      const create = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        const oscillator = create.call(this);
        const start = oscillator.start.bind(oscillator);
        const audioContext = this;
        oscillator.start = (when = 0) => {
          recorded.soundStarts.push({
            frequency: oscillator.frequency.value,
            wallTime:
              Date.now() + Math.max(0, when - audioContext.currentTime) * 1000,
          });
          start(when);
        };
        return oscillator;
      };
    },
    { recordTones },
  );
}

export const soundStarts = (page: Page) =>
  page.evaluate(
    () => (window as typeof window & { soundStarts: SoundStart[] }).soundStarts,
  );
