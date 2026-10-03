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

/** The lobby keeps name and animal in a sheet, opened from the arena. */
export async function openProfile(page: Page) {
  const name = page.getByLabel("Your name", { exact: true });
  if (!(await name.isVisible()))
    await page
      .getByRole("button", { name: /Change your name or animal/ })
      .click();
  await expect(name).toBeVisible();
}

export async function closeProfile(page: Page) {
  // The lobby and a first visit's profile sheet render together.
  await expect(
    page.getByRole("button", { name: /Change your name or animal/ }),
  ).toBeVisible();
  const sheet = page.getByRole("dialog", { name: "Edit your profile" });
  if (await sheet.isVisible()) await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
}

export async function saveProfile(page: Page, name: string) {
  await page.bringToFront();
  await openProfile(page);
  await page.getByLabel("Your name", { exact: true }).fill(name);
  // Saving also closes the sheet.
  await page
    .getByRole("button", { name: "Save profile", exact: true })
    .click({ noWaitAfter: true });
  await expect(
    page.getByRole("dialog", { name: "Edit your profile" }),
  ).toHaveCount(0);
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

/**
 * Replaces Web Audio with a silent mock that records every oscillator start, so tests
 * check which tones the game schedules and when without touching the host audio stack
 * (a stuck audio service can stall even a silent-sink AudioContext for ~20s per page).
 * Like a real browser, contexts start suspended and only run once resumed by a gesture.
 */
export async function installSilentAudio(
  context: BrowserContext,
  recordTones = false,
) {
  await context.addInitScript(
    ({ recordTones }) => {
      const recorded = window as typeof window & {
        soundStarts: SoundStart[];
        audioContexts: unknown[];
      };
      recorded.soundStarts = [];
      recorded.audioContexts = [];
      const param = () => ({
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      });
      const node = () => ({ connect() {}, disconnect() {} });
      class MockAudioContext {
        state: AudioContextState = "suspended";
        destination = node();
        private readonly createdAt = performance.now();
        constructor() {
          recorded.audioContexts.push(this);
        }
        get currentTime() {
          return (performance.now() - this.createdAt) / 1000;
        }
        resume() {
          if (this.state !== "closed") this.state = "running";
          return Promise.resolve();
        }
        suspend() {
          if (this.state !== "closed") this.state = "suspended";
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
              if (!recordTones) return;
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
        value: MockAudioContext,
        configurable: true,
      });
    },
    { recordTones },
  );
}

export const soundStarts = (page: Page) =>
  page.evaluate(
    () => (window as typeof window & { soundStarts: SoundStart[] }).soundStarts,
  );
