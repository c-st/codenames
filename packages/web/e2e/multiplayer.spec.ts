import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { GameStateForClient } from "schema";
import { recordSounds, roomUrl, saveProfile, watchRoom } from "./support";

function assignments(state: GameStateForClient | undefined) {
  return state?.players
    .map(({ id, name, animal, team, role }) => ({
      id,
      name,
      animal,
      team,
      role,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

const rosterNames = (state: GameStateForClient | undefined) =>
  state?.players.map((player) => player.name).sort();

async function openEditor(page: Page) {
  await page
    .getByText("Create or edit a custom word pack", { exact: false })
    .click();
  await expect(
    page.getByLabel("Your words (up to 50 characters each)"),
  ).toBeVisible();
}

test("profile survives reload, reconnect and a fresh browser session without duplicate players", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await recordSounds(context);
  let restored: BrowserContext | undefined;
  await context.addInitScript((apiPort) => {
    const tracked = window as typeof window & { roomSockets: WebSocket[] };
    tracked.roomSockets = [];
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args: ConstructorParameters<typeof WebSocket>) {
        super(...args);
        if (String(args[0]).includes(`:${apiPort}/`))
          tracked.roomSockets.push(this);
      }
    };
  }, process.env.E2E_API_PORT ?? "8787");
  try {
    const page = await context.newPage();
    const state = watchRoom(page);
    const url = roomUrl();
    await page.goto(url);
    const animal = page.getByLabel("Your animal", { exact: true });
    await animal.selectOption({ index: 1 });
    const selectedAnimal = await animal.inputValue();
    await saveProfile(page, "Reconnect Ranger");
    await expect.poll(() => state()?.players[0]?.name).toBe("Reconnect Ranger");
    const id = state()!.playerId;

    // Repeated reloads exercise overlapping close/open websocket lifecycles.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.reload();
      await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
        "Reconnect Ranger",
      );
      await expect(animal).toHaveValue(selectedAnimal);
      await expect.poll(() => state()?.playerId).toBe(id);
      await expect
        .poll(() => state()?.players.map((player) => player.id))
        .toEqual([id]);
      await expect(
        page.getByRole("button", { name: /Reconnect Ranger/ }),
      ).toHaveCount(1);
    }

    const beforeReconnect = state();
    await context.setOffline(true);
    // Chromium may keep established websocket streams alive when setOffline is
    // toggled. Close the actual room transport while offline to model a dropped link.
    await page.evaluate(() => {
      for (const socket of (
        window as typeof window & { roomSockets: WebSocket[] }
      ).roomSockets) {
        if (socket.readyState === WebSocket.OPEN)
          socket.close(4001, "Simulated network loss");
      }
    });
    await expect(page.getByText(/Reconnecting/).first()).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(/Reconnecting/)).toHaveCount(0);
    await expect.poll(() => state() !== beforeReconnect).toBe(true);
    await expect
      .poll(() => state()?.players.map((player) => player.id))
      .toEqual([id]);
    await expect(
      page.getByRole("button", { name: /Reconnect Ranger/ }),
    ).toHaveCount(1);

    const secondTab = await context.newPage();
    const secondState = watchRoom(secondTab);
    await secondTab.goto(url);
    await expect.poll(() => secondState()?.playerId).toBe(id);
    await expect
      .poll(() => secondState()?.players.map((player) => player.id))
      .toEqual([id]);
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await secondTab.close();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await saveProfile(page, "Reconnect Ranger");
    await expect
      .poll(() => state()?.players.map((player) => player.id))
      .toEqual([id]);

    // storageState models reopening the browser: room identity and profile survive.

    const storageState = await context.storageState();
    await context.close();
    restored = await browser.newContext({ storageState });
    await recordSounds(restored);
    const freshPage = await restored.newPage();
    const freshState = watchRoom(freshPage);
    await freshPage.goto(url);
    await expect.poll(() => freshState()?.playerId).toBe(id);
    await expect
      .poll(() => freshState()?.players.map((player) => player.id))
      .toEqual([id]);
    await freshPage.goto(roomUrl());
    await expect(
      freshPage.getByLabel("Your name", { exact: true }),
    ).toHaveValue("Reconnect Ranger");
    await expect(
      freshPage.getByLabel("Your animal", { exact: true }),
    ).toHaveValue(selectedAnimal);
    await expect
      .poll(() =>
        freshState()?.players.map(({ name, animal }) => ({ name, animal })),
      )
      .toEqual([{ name: "Reconnect Ranger", animal: selectedAnimal }]);
  } finally {
    await context.close();
    await restored?.close();
  }
});

test("four independent players share custom words, shuffled roles and the same board", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  try {
    await Promise.all(contexts.map(recordSounds));
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const states = pages.map(watchRoom);
    const url = roomUrl();
    const names = ["Alpha Otter", "Beta Lynx", "Gamma Owl", "Delta Fox"];
    for (let i = 0; i < pages.length; i++) {
      await pages[i].goto(url);
      await saveProfile(pages[i], names[i]);
    }
    for (const state of states) {
      await expect.poll(() => rosterNames(state())).toEqual([...names].sort());
      await expect
        .poll(() => new Set(state()?.players.map((player) => player.id)).size)
        .toBe(4);
    }

    const words = Array.from({ length: 30 }, (_, i) =>
      i >= 24 ? `${"Z".repeat(48)}${i + 1}` : `Custom Word ${i + 1}`,
    );
    await openEditor(pages[0]);
    const input = pages[0].getByLabel("Your words (up to 50 characters each)");
    await input.fill("Too few\nwords");
    await expect(
      pages[0].getByRole("button", { name: "Save & use custom pack" }),
    ).toBeDisabled();
    await input.fill([...words, words[0].toLowerCase()].join("\n"));
    await expect(
      pages[0].getByText("30 unique words · 1 duplicate removed automatically"),
    ).toBeVisible();
    await pages[0]
      .getByRole("button", { name: "Save & use custom pack" })
      .click();
    for (const state of states) {
      await expect.poll(() => state()?.customWords).toEqual(words);
      await expect.poll(() => state()?.wordPack).toBe("custom");
    }
    for (const page of pages.slice(1)) {
      await openEditor(page);
      await page
        .getByRole("button", { name: "Load room’s saved list" })
        .click();
      await expect(
        page.getByLabel("Your words (up to 50 characters each)"),
      ).toHaveValue(words.join("\n"));
    }

    const beforeShuffle = states.map((state) => state());
    await pages[0]
      .getByRole("button", { name: /Shuffle teams & spymasters/ })
      .click();
    for (let i = 0; i < states.length; i++) {
      await expect.poll(() => states[i]() !== beforeShuffle[i]).toBe(true);
    }
    for (const state of states) {
      await expect.poll(() => state()?.gameCanStart).toBe(true);
      await expect
        .poll(() => assignments(state()))
        .toEqual(assignments(states[0]()));
      await expect
        .poll(
          () =>
            state()?.players.filter((player) => player.role === "spymaster")
              .length,
        )
        .toBe(2);
      for (const team of [0, 1]) {
        expect(
          state()!.players.filter((player) => player.team === team),
        ).toHaveLength(2);
        expect(
          state()!.players.filter(
            (player) => player.team === team && player.role === "spymaster",
          ),
        ).toHaveLength(1);
      }
    }
    await pages[0]
      .getByRole("button", { name: "Start Game", exact: true })
      .click();
    for (let i = 0; i < pages.length; i++) {
      await expect.poll(() => states[i]()?.board.length).toBe(25);
      await expect
        .poll(() => states[i]()?.board.map((card) => card.word))
        .toEqual(states[0]()!.board.map((card) => card.word));
      for (const card of states[i]()!.board) expect(words).toContain(card.word);
      await expect(
        pages[i].getByRole("button", { name: /^(Custom Word |Z{48}\d{2})/ }),
      ).toHaveCount(25);
      // Before any clue, guesses are disabled for every role and team.
      await expect(
        pages[i]
          .getByRole("button", { name: /^(Custom Word |Z{48}\d{2})/ })
          .first(),
      ).toBeDisabled();
    }
    // Find the current spymaster and operative from authoritative shuffled roles.
    const activeTeam = states[0]()!.turn!.team;
    const spyIndex = states.findIndex((state) =>
      state()!.players.some(
        (player) =>
          player.id === state()!.playerId &&
          player.team === activeTeam &&
          player.role === "spymaster",
      ),
    );
    const operativeIndex = states.findIndex((state) =>
      state()!.players.some(
        (player) =>
          player.id === state()!.playerId &&
          player.team === activeTeam &&
          player.role === "operative",
      ),
    );
    expect(spyIndex).toBeGreaterThanOrEqual(0);
    expect(operativeIndex).toBeGreaterThanOrEqual(0);
    const card = states[spyIndex]()!.board.find(
      (word) => word.team === activeTeam && !word.isAssassin,
    )!;
    await pages[spyIndex]
      .getByPlaceholder("Hint word", { exact: true })
      .fill("Connection");
    await pages[spyIndex]
      .getByRole("button", { name: "Give hint", exact: true })
      .click();
    for (const state of states)
      await expect.poll(() => state()?.turn?.hint?.hint).toBe("Connection");
    for (const page of pages) {
      // A real key gesture unlocks the AudioContext in every independently joined tab.
      await page.keyboard.press("Shift");
    }
    await pages[operativeIndex]
      .getByRole("button", { name: card.word, exact: true })
      .click();
    for (const state of states) {
      await expect
        .poll(
          () =>
            state()?.board.find((word) => word.word === card.word)?.revealed
              ?.byTeam,
        )
        .toBe(activeTeam);
      await expect.poll(() => state()?.effects?.[0]?.type).toBe("correctGuess");
      await expect.poll(() => state()?.effects).toEqual(states[0]()!.effects);
    }
    const playAt = states[0]()!.effects![0].playAt;
    const recordedStarts: number[] = [];
    for (const page of pages) {
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as typeof window & {
                  soundStarts: { frequency: number }[];
                }
              ).soundStarts.filter((tone) => tone.frequency === 523).length,
          ),
        )
        .toBe(1);
      recordedStarts.push(
        await page.evaluate(
          () =>
            (
              window as typeof window & {
                soundStarts: { frequency: number; wallTime: number }[];
              }
            ).soundStarts.find((tone) => tone.frequency === 523)!.wallTime,
        ),
      );
    }
    // Local clocks share a machine here; all clients should schedule the same cue
    // close to the server deadline. This checks actual Web Audio starts, not only JSON.
    for (const scheduled of recordedStarts)
      expect(Math.abs(scheduled - playAt)).toBeLessThan(200);
    expect(
      Math.max(...recordedStarts) - Math.min(...recordedStarts),
    ).toBeLessThan(200);
    await pages[operativeIndex].screenshot({
      path: "test-results/multiplayer-board.png",
      fullPage: true,
    });
    await pages[operativeIndex].setViewportSize({ width: 390, height: 844 });
    expect(
      await pages[operativeIndex]
        .getByRole("button", { name: /^Z{48}\d{2}/ })
        .count(),
    ).toBeGreaterThan(0);
    await expect
      .poll(() =>
        pages[operativeIndex].evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await pages[operativeIndex].screenshot({
      path: "test-results/multiplayer-board-mobile.png",
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
