import { expect, test } from "@playwright/test";
import { installSilentAudio, roomUrl, saveProfile, watchRoom } from "./support";

test("landing interactions do not initialize a native audio device", async ({
  context,
  page,
}) => {
  await installSilentAudio(context);
  await page.goto("/");
  await page.keyboard.press("Shift");
  await page
    .getByRole("button", { name: "Learn to play", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { audioContexts: unknown[] }).audioContexts
          .length,
    ),
  ).toBe(0);
});

test("persisted mute prevents initialization and muting closes existing audio", async ({
  context,
  page,
}) => {
  await installSilentAudio(context);
  await context.addInitScript(() =>
    localStorage.setItem("codenames:muted", "true"),
  );
  const state = watchRoom(page);
  await page.goto(roomUrl());
  await expect.poll(() => state()?.playerId).toBeTruthy();
  await saveProfile(page, "Quiet Fox");
  await page.keyboard.press("Shift");
  const states = () =>
    page.evaluate(() =>
      (
        window as typeof window & { audioContexts: { state: string }[] }
      ).audioContexts.map((audio) => audio.state),
    );
  expect(await states()).toEqual([]);
  await page.getByTitle("Unmute", { exact: true }).click();
  await page.keyboard.press("Shift");
  await expect.poll(states).toEqual(["running"]);
  await page.getByTitle("Mute", { exact: true }).click();
  await expect.poll(states).toEqual(["closed"]);
  await page.keyboard.press("Shift");
  expect(await states()).toEqual(["closed"]);
  await page.getByTitle("Unmute", { exact: true }).click();
  await page.keyboard.press("Shift");
  await expect.poll(states).toEqual(["closed", "running"]);
  await page
    .getByRole("button", { name: "← Back to home", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect.poll(states).toEqual([]);
  await page.keyboard.press("Shift");
  expect(await states()).toEqual([]);
});

test("audio construction and synchronous or async device failures leave the lobby usable", async ({
  context,
  page,
}) => {
  await installSilentAudio(context);
  await context.addInitScript(() => {
    const BaseContext = window.AudioContext;
    let attempts = 0;
    const recorded = window as typeof window & { audioCloseFailures: string[] };
    recorded.audioCloseFailures = [];
    class UnavailableAudioContext extends BaseContext {
      constructor() {
        if (++attempts === 1) throw new Error("Audio device unavailable");
        super();
      }
      resume() {
        return Promise.reject(new Error("Device resume unavailable"));
      }
      close() {
        void super.close();
        if (recorded.audioCloseFailures.length === 1) {
          recorded.audioCloseFailures.push("thrown");
          throw new Error("Device close threw synchronously");
        }
        recorded.audioCloseFailures.push("rejected");
        return Promise.reject(new Error("Device close unavailable"));
      }
    }
    Object.defineProperty(window, "AudioContext", {
      value: UnavailableAudioContext,
      configurable: true,
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const state = watchRoom(page);
  await page.goto(roomUrl());
  await expect.poll(() => state()?.playerId).toBeTruthy();
  await page.keyboard.press("Shift");
  await page.keyboard.press("Shift");
  await saveProfile(page, "Resilient Fox");
  await page.getByTitle("Mute", { exact: true }).click();
  await expect(page.getByTitle("Unmute", { exact: true })).toBeVisible();
  await page.getByTitle("Unmute", { exact: true }).click();
  await page.keyboard.press("Shift");
  await page.getByTitle("Mute", { exact: true }).click();
  await expect(page.getByTitle("Unmute", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { audioCloseFailures: string[] })
          .audioCloseFailures,
    ),
  ).toEqual(["rejected", "thrown"]);
  expect(errors).toEqual([]);
});
