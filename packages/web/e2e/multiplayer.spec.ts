import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { animalNames, type GameStateForClient } from "schema";
import { getTeamName } from "../components/Game/Board/getTeamColor";
import {
  closeProfile,
  installSilentAudio,
  openProfile,
  recordFrames,
  roomUrl,
  saveProfile,
  watchRoom,
} from "./support";

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
  await page.bringToFront();
  // Fresh browsers are greeted with the profile sheet first.
  await closeProfile(page);
  await page.getByText("Edit room word packs", { exact: false }).click();
  await expect(
    page.getByLabel("Your words (up to 50 characters each)"),
  ).toBeVisible();
}

async function openHistory(page: Page) {
  await page.bringToFront();
  const panel = page.getByRole("group", { name: "Room history", exact: true });
  if ((await panel.getAttribute("open")) === null)
    await panel.locator(":scope > summary").click({ noWaitAfter: true });
  return panel;
}

test("profile survives reload, reconnect and a fresh browser session without duplicate players", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await installSilentAudio(context);
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
    // A first visit greets the player with the profile editor and a matching identity.
    await expect(
      page.getByRole("dialog", { name: "Edit your profile" }),
    ).toBeVisible();
    await expect.poll(() => state()?.players[0]?.animal).toBeTruthy();
    const assigned = state()!.players[0];
    expect(assigned.name).toMatch(
      new RegExp(` ${animalNames[assigned.animal!]}$`),
    );
    await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
      assigned.name,
    );
    // A generated name follows the animal.
    const other = assigned.animal === "🦉" ? "🐧" : "🦉";
    await page
      .getByRole("radio", { name: new RegExp(`^${animalNames[other]}`) })
      .click();
    await expect
      .poll(() => state()?.players[0]?.name)
      .toBe(
        assigned.name.replace(
          new RegExp(`${animalNames[assigned.animal!]}$`),
          animalNames[other],
        ),
      );
    // The animal grid applies a pick instantly; arrow keys move like native radios.
    await openProfile(page);
    const animals = page.getByRole("radiogroup", { name: "Your animal" });
    await animals.getByRole("radio", { name: /^Dog/ }).click();
    await expect.poll(() => state()?.players[0]?.animal).toBe("🐶");
    await page.keyboard.press("ArrowLeft");
    await expect(animals.getByRole("radio", { name: /^Cat/ })).toBeFocused();
    const selectedAnimal = "🐱";
    await expect.poll(() => state()?.players[0]?.animal).toBe(selectedAnimal);
    const animal = page.getByRole("radio", { name: /^Cat/ });
    await expect(animal).toHaveAttribute("aria-checked", "true");
    await saveProfile(page, "Reconnect Ranger");
    await expect.poll(() => state()?.players[0]?.name).toBe("Reconnect Ranger");
    const id = state()!.playerId;

    // Repeated reloads exercise overlapping close/open websocket lifecycles.
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.reload();
      await openProfile(page);
      await expect(page.getByLabel("Your name", { exact: true })).toHaveValue(
        "Reconnect Ranger",
      );
      await expect(animal).toHaveAttribute("aria-checked", "true");
      await closeProfile(page);
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
    await installSilentAudio(restored);
    const freshPage = await restored.newPage();
    const freshState = watchRoom(freshPage);
    await freshPage.goto(url);
    await expect.poll(() => freshState()?.playerId).toBe(id);
    await expect
      .poll(() => freshState()?.players.map((player) => player.id))
      .toEqual([id]);
    await freshPage.goto(roomUrl());
    await openProfile(freshPage);
    await expect(
      freshPage.getByLabel("Your name", { exact: true }),
    ).toHaveValue("Reconnect Ranger");
    await expect(
      freshPage.getByRole("radio", { name: /^Cat/ }),
    ).toHaveAttribute("aria-checked", "true");
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
  test.setTimeout(180_000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  try {
    await Promise.all(
      contexts.map((context) => installSilentAudio(context, true)),
    );
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
    await pages[0].getByRole("button", { name: "Add word pack" }).click();
    await pages[0]
      .getByLabel("Pack name", { exact: true })
      .fill("Multiplayer mix");
    const input = pages[0].getByLabel("Your words (up to 50 characters each)");
    await input.fill("Too few\nwords");
    await expect(
      pages[0].getByRole("button", { name: "Save word pack" }),
    ).toBeDisabled();
    await input.fill([...words, words[0].toLowerCase()].join("\n"));
    await expect(
      pages[0].getByText("30 unique words · 1 duplicate removed automatically"),
    ).toBeVisible();
    await pages[0].getByRole("button", { name: "Save word pack" }).click();
    await expect
      .poll(
        () =>
          states[0]()?.wordPacks?.find(
            (pack) => pack.name === "Multiplayer mix",
          )?.words,
      )
      .toEqual(words);
    const packId = states[0]()!.wordPacks!.find(
      (pack) => pack.name === "Multiplayer mix",
    )!.id;
    for (const state of states) {
      await expect
        .poll(
          () => state()?.wordPacks?.find((pack) => pack.id === packId)?.words,
        )
        .toEqual(words);
      await expect.poll(() => state()?.wordPack).toBe("classic");
    }
    await pages[0]
      .getByLabel("Other room word packs", { exact: true })
      .selectOption(packId);
    for (const state of states)
      await expect.poll(() => state()?.wordPack).toBe(packId);
    for (const page of pages.slice(1)) {
      await openEditor(page);
      await page
        .getByLabel("Pack to edit", { exact: true })
        .selectOption(packId);
      await expect(
        page.getByLabel("Your words (up to 50 characters each)"),
      ).toHaveValue(words.join("\n"));
    }

    const beforeShuffle = states.map((state) => state());
    await pages[0]
      .getByRole("button", { name: /Shuffle teams & spymasters/ })
      .click();
    // Everyone watches the same countdown; nobody can start mid-ceremony.
    await expect.poll(() => states[0]()?.shuffleAt).toBeGreaterThan(0);
    const shuffleAt = states[0]()!.shuffleAt;
    for (let i = 0; i < pages.length; i++) {
      await expect.poll(() => states[i]()?.shuffleAt).toBe(shuffleAt);
      await expect(pages[i].locator('[data-shuffle="counting"]')).toBeVisible();
      await expect(
        pages[i].getByRole("button", { name: /Shuffle teams & spymasters/ }),
      ).toBeDisabled();
    }
    for (let i = 0; i < states.length; i++) {
      await expect.poll(() => states[i]()?.shuffleAt).toBeUndefined();
      expect(states[i]() !== beforeShuffle[i]).toBe(true);
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
    await pages[0].bringToFront();
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
    await pages[spyIndex].bringToFront();
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
      await page.bringToFront();
      await page.keyboard.press("Shift");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as typeof window & { audioContexts: AudioContext[] }
              ).audioContexts.at(-1)?.state,
          ),
        )
        .toBe("running");
    }
    await pages[operativeIndex].bringToFront();
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
    for (let i = 0; i < pages.length; i++) {
      await expect
        .poll(() => states[i]()?.sessionHistory?.rounds[0]?.events)
        .toEqual([
          expect.objectContaining({
            type: "hint",
            team: activeTeam,
            hint: "Connection",
            count: 2,
          }),
          expect.objectContaining({
            type: "guess",
            team: activeTeam,
            word: card.word,
            outcome: "correct",
          }),
        ]);
      await expect
        .poll(() => states[i]()?.sessionHistory)
        .toEqual(states[0]()!.sessionHistory);
      const history = await openHistory(pages[i]);
      await expect(
        history.getByText("Active round", { exact: true }),
      ).toBeVisible();
      await expect(
        history.getByLabel("Total guesses", { exact: true }),
      ).toHaveText("1");
      await expect(
        history.getByLabel("Guess accuracy", { exact: true }),
      ).toHaveText("100%");
      await expect(
        history
          .getByRole("list", { name: "Round events" })
          .getByText(card.word, { exact: true }),
      ).toBeVisible();
    }
    await pages[operativeIndex].screenshot({
      path: "test-results/multiplayer-board.png",
      fullPage: true,
      animations: "disabled",
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
      animations: "disabled",
    });
    await pages[0].bringToFront();
    await pages[0]
      .getByRole("button", { name: "End game", exact: true })
      .click();
    for (let i = 0; i < pages.length; i++) {
      await expect
        .poll(() => states[i]()?.sessionHistory?.rounds[0]?.status)
        .toBe("aborted");
      const history = await openHistory(pages[i]);
      await expect(
        history.getByText("Aborted round", { exact: true }),
      ).toBeVisible();
      await expect(
        history.getByLabel("Rounds completed", { exact: true }),
      ).toHaveText("0");
    }
    const roomAwardSeed = states[0]()!.sessionHistory!.awardSeed;
    const retainedTitles = await (await openHistory(pages[0]))
      .getByRole("heading", { level: 4 })
      .allTextContents();
    await pages[0].reload();
    await expect
      .poll(() => states[0]()?.sessionHistory?.rounds[0]?.status)
      .toBe("aborted");
    await expect(
      (await openHistory(pages[0])).getByLabel("Total guesses", {
        exact: true,
      }),
    ).toHaveText("1");

    // Finish a rematch to verify completed-round averages, team wins and retained accuracy.
    await pages[0].bringToFront();
    await pages[0]
      .getByRole("button", { name: "Start Game", exact: true })
      .click();
    for (const state of states)
      await expect.poll(() => state()?.sessionHistory?.rounds.length).toBe(2);
    const winner = states[0]()!.turn!.team;
    const winningSpy = states.findIndex((state) =>
      state()!.players.some(
        (player) =>
          player.id === state()!.playerId &&
          player.team === winner &&
          player.role === "spymaster",
      ),
    );
    const winningOperative = states.findIndex((state) =>
      state()!.players.some(
        (player) =>
          player.id === state()!.playerId &&
          player.team === winner &&
          player.role === "operative",
      ),
    );
    const winningSpyPlayer = states[winningSpy]()!.players.find(
      (player) => player.id === states[winningSpy]()!.playerId,
    )!;
    const initialSpyPlayerId = states[spyIndex]()!.playerId;
    const winningWords = states[winningSpy]()!
      .board.filter((word) => word.team === winner)
      .map((word) => word.word);
    await pages[winningSpy].bringToFront();
    await pages[winningSpy]
      .getByPlaceholder("Hint word", { exact: true })
      .fill("Victory");
    await pages[winningSpy].getByRole("spinbutton").fill("9");
    await pages[winningSpy]
      .getByRole("button", { name: "Give hint", exact: true })
      .click();
    for (const state of states)
      await expect.poll(() => state()?.turn?.hint?.hint).toBe("Victory");
    await pages[winningOperative].bringToFront();
    for (const word of winningWords) {
      await pages[winningOperative]
        .getByRole("button", { name: word, exact: true })
        .click();
      await expect
        .poll(
          () =>
            states[winningOperative]()?.board.find((card) => card.word === word)
              ?.revealed?.byTeam,
        )
        .toBe(winner);
    }
    for (let i = 0; i < pages.length; i++) {
      await expect
        .poll(() => states[i]()?.sessionHistory?.rounds[1]?.status)
        .toBe("completed");
      await expect
        .poll(() => states[i]()?.sessionHistory?.awardSeed)
        .toBe(roomAwardSeed);
      await expect
        .poll(() => states[i]()?.sessionHistory)
        .toEqual(states[0]()!.sessionHistory);
      const history = await openHistory(pages[i]);
      await expect(
        history.getByLabel("Rounds completed", { exact: true }),
      ).toHaveText("1");
      await expect(
        history.getByLabel("Total guesses", { exact: true }),
      ).toHaveText(String(1 + winningWords.length));
      await expect(
        history.getByLabel("Guess accuracy", { exact: true }),
      ).toHaveText("100%");
      await expect(
        history.getByLabel(`${getTeamName(winner)} wins`, { exact: true }),
      ).toHaveText("1");
      await expect(
        history.getByLabel("Avg. completed round", { exact: true }),
      ).toHaveText(/\d+[smh]/);
      await expect
        .poll(() =>
          states[i]()
            ?.sessionHistory?.rounds[1]?.events.filter(
              (event) => event.type === "guess",
            )
            .map((event) => event.spymaster?.id),
        )
        .toEqual(winningWords.map(() => winningSpyPlayer.id));
      const clueAward = history.locator(
        'article[data-award="spy-most-correct"]',
      );
      await expect(
        clueAward.getByText(winningSpyPlayer.name, { exact: true }),
      ).toBeVisible();
      await expect(
        clueAward.getByText(
          `${winningWords.length + (initialSpyPlayerId === winningSpyPlayer.id ? 1 : 0)} correct guesses`,
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        history
          .locator('article[data-award="team-most-correct"]')
          .getByText(`Team ${getTeamName(winner)}`, { exact: true }),
      ).toBeVisible();
      const titles = await history
        .getByRole("heading", { level: 4 })
        .allTextContents();
      for (const retainedTitle of retainedTitles)
        expect(titles).toContain(retainedTitle);
      expect(titles).toEqual(
        await (await openHistory(pages[0]))
          .getByRole("heading", { level: 4 })
          .allTextContents(),
      );
      await expect(
        history.getByText(`${getTeamName(winner)} wins`, { exact: true }),
      ).toBeVisible();
    }
    await pages[0].setViewportSize({ width: 1280, height: 900 });
    await pages[0].screenshot({
      path: "test-results/session-history.png",
      fullPage: true,
      animations: "disabled",
    });
    await pages[0].setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        pages[0].evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await pages[0].screenshot({
      path: "test-results/session-history-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("an empty room expires through real durable alarms and reopens with fresh settings", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  let reopened: BrowserContext | undefined;
  try {
    await Promise.all(contexts.map((context) => installSilentAudio(context)));
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const states = pages.map(watchRoom);
    const url = roomUrl();
    for (const page of pages) {
      await page.goto(url);
      await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    }
    await expect.poll(() => states[0]()?.players.length).toBe(4);
    await openEditor(pages[0]);
    await pages[0].getByRole("button", { name: "Add word pack" }).click();
    await pages[0].getByLabel("Pack name", { exact: true }).fill("Expiry mix");
    const words = Array.from({ length: 25 }, (_, i) => `Expiry Word ${i + 1}`);
    await pages[0]
      .getByLabel("Your words (up to 50 characters each)")
      .fill(words.join("\n"));
    await pages[0].getByRole("button", { name: "Save word pack" }).click();
    await expect
      .poll(
        () =>
          states[0]()?.wordPacks?.find((pack) => pack.name === "Expiry mix")
            ?.words,
      )
      .toEqual(words);
    await pages[0]
      .getByRole("button", { name: /Shuffle teams & spymasters/ })
      .click();
    await pages[0].bringToFront();
    await pages[0]
      .getByRole("button", { name: "Start Game", exact: true })
      .click();
    await expect.poll(() => states[0]()?.sessionHistory?.rounds.length).toBe(1);
    await pages[0].bringToFront();
    await pages[0]
      .getByRole("button", { name: "End game", exact: true })
      .click();
    await expect
      .poll(() => states[0]()?.sessionHistory?.rounds[0]?.status)
      .toBe("aborted");
    await Promise.all(contexts.map((context) => context.close()));

    // The worker has a test-only 60-second idle TTL. No connection to this room
    // remains alive while the actual Wrangler alarm deletes its durable storage.
    reopened = await browser.newContext();
    await installSilentAudio(reopened);
    const observer = await reopened.newPage();
    await observer.waitForTimeout(62_000);
    const state = watchRoom(observer);
    await observer.goto(url);
    await closeProfile(observer);
    await expect.poll(() => state()?.wordPack).toBe("classic");
    await expect.poll(() => state()?.wordPacks?.length).toBe(10);
    await expect
      .poll(() =>
        state()?.wordPacks?.some((pack) => pack.name === "Expiry mix"),
      )
      .toBe(false);
    await expect.poll(() => state()?.sessionHistory?.rounds).toEqual([]);
    await expect.poll(() => state()?.players.length).toBe(1);
    await expect(
      (await openHistory(observer)).getByText("No rounds yet", { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    await reopened?.close();
  }
});

test("room pack library preserves drafts, rejects stale edits and keeps Classic available", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  try {
    await Promise.all(contexts.map((context) => installSilentAudio(context)));
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const states = pages.map(watchRoom);
    const secondFrames = recordFrames(pages[1]);
    const url = roomUrl();
    for (const page of pages) {
      await page.goto(url);
      await expect(page.getByText("Connected", { exact: true })).toBeVisible();
      await openEditor(page);
      await page
        .getByLabel("Pack to edit", { exact: true })
        .selectOption("classic");
    }
    const first = Array.from(
      { length: 25 },
      (_, i) => `First Classic ${i + 1}`,
    );
    const second = Array.from(
      { length: 25 },
      (_, i) => `Second Classic ${i + 1}`,
    );
    const input = (page: Page) =>
      page.getByLabel("Your words (up to 50 characters each)");
    // Both drafts start from revision zero before either player saves.
    await input(pages[0]).fill(first.join("\n"));
    await input(pages[1]).fill(second.join("\n"));
    await pages[0].bringToFront();
    await pages[0].getByRole("button", { name: "Save word pack" }).click();
    for (const state of states)
      await expect
        .poll(
          () =>
            state()?.wordPacks?.find((pack) => pack.id === "classic")?.words,
        )
        .toEqual(first);
    await expect(input(pages[1])).toHaveValue(second.join("\n"));
    await pages[1].bringToFront();
    await pages[1].getByRole("button", { name: "Save word pack" }).click();
    await expect
      .poll(() =>
        secondFrames.some((frame) => {
          try {
            const event = JSON.parse(frame);
            return (
              event.type === "wordPackSaveRejected" &&
              event.code === "conflict" &&
              event.packId === "classic"
            );
          } catch {
            return false;
          }
        }),
      )
      .toBe(true);
    await expect(
      pages[1].getByRole("button", { name: "Save word pack" }),
    ).toBeDisabled();
    await expect(input(pages[1])).toHaveValue(second.join("\n"));
    expect(
      states[1]()!.wordPacks!.find((pack) => pack.id === "classic")!.words,
    ).toEqual(first);
    await pages[1]
      .getByText("Review latest room version", { exact: true })
      .click();
    await expect(pages[1].getByLabel("Latest room words")).toHaveValue(
      first.join("\n"),
    );
    await pages[1]
      .getByRole("button", { name: "Keep my edits on latest version" })
      .click();
    await pages[1].getByRole("button", { name: "Save word pack" }).click();
    for (const state of states)
      await expect
        .poll(
          () =>
            state()?.wordPacks?.find((pack) => pack.id === "classic")?.words,
        )
        .toEqual(second);
    await pages[0]
      .getByRole("button", { name: "Load latest room version" })
      .click();
    await expect(input(pages[0])).toHaveValue(second.join("\n"));
    await expect(pages[0].getByLabel("Pack name", { exact: true })).toHaveValue(
      "Classic",
    );
    await expect(
      pages[0].getByLabel("Pack name", { exact: true }),
    ).toHaveAttribute("readonly", "");

    await pages[0].bringToFront();
    await pages[0].getByRole("button", { name: "Add word pack" }).click();
    await pages[0]
      .getByLabel("Pack name", { exact: true })
      .fill("Shared favourites");
    await input(pages[0]).fill(first.join("\n"));
    // Reload restores a new pack draft, including its unique ID and base revision.
    await pages[0].reload();
    await expect(
      pages[0].getByText("Connected", { exact: true }),
    ).toBeVisible();
    await openEditor(pages[0]);
    await expect(pages[0].getByLabel("Pack name", { exact: true })).toHaveValue(
      "Shared favourites",
    );
    await expect(input(pages[0])).toHaveValue(first.join("\n"));
    await pages[0].getByRole("button", { name: "Save word pack" }).click();
    await expect
      .poll(
        () =>
          states[1]()?.wordPacks?.find(
            (pack) => pack.name === "Shared favourites",
          )?.words,
      )
      .toEqual(first);
    const id = states[1]()!.wordPacks!.find(
      (pack) => pack.name === "Shared favourites",
    )!.id;
    for (const state of states)
      await expect.poll(() => state()?.wordPack).toBe("classic");
    await pages[1]
      .getByLabel("Other room word packs", { exact: true })
      .selectOption(id);
    for (const state of states)
      await expect.poll(() => state()?.wordPack).toBe(id);
    await pages[1].reload();
    await expect.poll(() => states[1]()?.wordPack).toBe(id);
    await expect(
      pages[1].getByLabel("Other room word packs", { exact: true }),
    ).toHaveValue(id);
    await pages[1]
      .getByRole("button", { name: "📝 Classic", exact: true })
      .click();
    for (const state of states)
      await expect.poll(() => state()?.wordPack).toBe("classic");
    for (const state of states)
      expect(
        state()!.wordPacks!.find((pack) => pack.id === "classic")!.words,
      ).toEqual(second);
    await pages[0].bringToFront();
    await pages[0].screenshot({
      path: test.info().outputPath("word-pack-library-desktop.png"),
      fullPage: true,
    });
    await pages[0].setViewportSize({ width: 375, height: 812 });
    await expect
      .poll(() =>
        pages[0].evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await pages[0].screenshot({
      path: test.info().outputPath("word-pack-library-mobile.png"),
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
