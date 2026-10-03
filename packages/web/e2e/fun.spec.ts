import { expect, test, type Browser, type Page } from "@playwright/test";
import type { GameStateForClient } from "schema";
import {
  expectAnnounced,
  recordFrames,
  recordSounds,
  roomUrl,
  saveProfile,
  soundStarts,
  watchEffects,
  watchRoom,
} from "./support";

const NAMES = ["Alpha Otter", "Beta Lynx", "Gamma Owl", "Delta Fox"];
const CARD_TAP_HZ = 600;
const HEARTBEAT_HZ = 70;
const BUZZER_HZ = 220;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const me = (state?: GameStateForClient) =>
  state?.players.find((player) => player.id === state.playerId);
const cardButton = (page: Page, word: string) =>
  page.getByRole("button", { name: new RegExp(`^${escape(word)}(,|$)`) });

/**
 * Four browsers join one room, shuffle into two teams and start a game. Returns the
 * page index for each role on the starting team and on the waiting team.
 */
async function startFourPlayerGame(
  browser: Browser,
  beforeJoin?: (page: Page, index: number) => Promise<void>,
) {
  const contexts = await Promise.all(NAMES.map(() => browser.newContext()));
  await Promise.all(contexts.map(recordSounds));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  if (process.env.E2E_DEBUG)
    pages.forEach((page, i) => {
      page.on("pageerror", (error) =>
        console.log(`[page ${i}] pageerror`, error.message),
      );
      page.on(
        "console",
        (msg) =>
          msg.type() === "error" &&
          console.log(`[page ${i}] console`, msg.text().slice(0, 300)),
      );
    });
  const states = pages.map(watchRoom);
  const effects = pages.map(watchEffects);
  const url = roomUrl();
  for (let i = 0; i < pages.length; i++) {
    await beforeJoin?.(pages[i], i);
    await pages[i].goto(url);
    await saveProfile(pages[i], NAMES[i]);
  }
  for (const state of states)
    await expect.poll(() => state()?.players.length).toBe(4);
  await pages[0]
    .getByRole("button", { name: /Shuffle teams & spymasters/ })
    .click();
  for (const state of states) {
    await expect.poll(() => state()?.gameCanStart).toBe(true);
    await expect
      .poll(() => state()?.players.filter((p) => p.role === "spymaster").length)
      .toBe(2);
  }
  await pages[0]
    .getByRole("button", { name: "Start Game", exact: true })
    .click();
  // Every client gets the "starts!" ribbon from the shared gameStart cue.
  await Promise.all(
    pages.map((page, i) => expectAnnounced(page, effects[i], "gameStart")),
  );
  for (const state of states)
    await expect.poll(() => state()?.board.length).toBe(25);
  // A real key gesture unlocks audio in each tab.
  for (const page of pages) await page.keyboard.press("Shift");

  const activeTeam = states[0]()!.turn!.team;
  const find = (team: "active" | "waiting", role: "spymaster" | "operative") =>
    states.findIndex((state) => {
      const player = me(state());
      return (
        player?.role === role &&
        (team === "active") === (player.team === activeTeam)
      );
    });
  const roles = {
    spy: find("active", "spymaster"),
    op: find("active", "operative"),
    otherSpy: find("waiting", "spymaster"),
    otherOp: find("waiting", "operative"),
  };
  for (const index of Object.values(roles))
    expect(index).toBeGreaterThanOrEqual(0);

  const giveHint = async (hint: string, count: number) => {
    const spyPage = pages[roles.spy];
    await spyPage.getByPlaceholder("Hint word", { exact: true }).fill(hint);
    await spyPage.getByRole("spinbutton").fill(String(count));
    await spyPage
      .getByRole("button", { name: "Give hint", exact: true })
      .click();
    for (const state of states)
      await expect.poll(() => state()?.turn?.hint?.hint).toBe(hint);
  };
  const close = () => Promise.all(contexts.map((context) => context.close()));
  return { pages, states, effects, roles, activeTeam, giveHint, close };
}

test("reveals flip with juice, marks are shared, reactions float and banners announce turns", async ({
  browser,
}) => {
  const game = await startFourPlayerGame(browser);
  const { pages, states, effects, roles, activeTeam } = game;
  try {
    const teamCards = states[roles.spy]()!
      .board.filter((card) => card.team === activeTeam && !card.isAssassin)
      .map((card) => card.word);
    const [first, second] = teamCards;
    await game.giveHint("Connection", 2);

    // Only guessing operatives get mark buttons; marks show up for everyone.
    const operative = pages[roles.op];
    await expect(operative.getByRole("button", { name: /^Mark / })).toHaveCount(
      25,
    );
    await expect(
      pages[roles.spy].getByRole("button", { name: /^Mark / }),
    ).toHaveCount(0);
    await expect(
      pages[roles.otherOp].getByRole("button", { name: /^Mark / }),
    ).toHaveCount(0);
    await operative
      .getByRole("button", { name: `Mark ${first}`, exact: true })
      .click();
    for (const page of pages)
      await expect(cardButton(page, first)).toHaveAccessibleName(
        new RegExp(`marked by ${NAMES[roles.op]}$`),
      );
    await operative
      .getByRole("button", { name: `Unmark ${first}`, exact: true })
      .click();
    for (const page of pages)
      await expect(cardButton(page, first)).not.toHaveAccessibleName(
        /marked by/,
      );

    // Tap: instant local click sound for the guesser only, then a flip with sparkles everywhere.
    const tapsBefore = await Promise.all(pages.map(soundStarts));
    await cardButton(operative, first).click();
    await Promise.all(
      pages.map(async (page) => {
        await expect(page.locator('[data-last-landing="correct"]')).toHaveCount(
          1,
        );
        await expect(cardButton(page, first)).toHaveAccessibleName(
          /, revealed/,
        );
        await expect(cardButton(page, first)).toHaveAttribute(
          "style",
          /rotateY\(180deg\)/,
        );
      }),
    );
    for (let i = 0; i < pages.length; i++) {
      const taps = (await soundStarts(pages[i]))
        .slice(tapsBefore[i].length)
        .filter((tone) => tone.frequency === CARD_TAP_HZ);
      expect(taps.length).toBe(i === roles.op ? 1 : 0);
    }

    // A reconnecting player sees the card face up, without replaying the landing.
    await pages[roles.otherOp].reload();
    await expect(cardButton(pages[roles.otherOp], first)).toHaveAccessibleName(
      /, revealed/,
    );
    await expect(cardButton(pages[roles.otherOp], first)).toHaveAttribute(
      "style",
      /rotateY\(180deg\)/,
    );
    // Give a replayed landing time to appear before asserting it never did.
    await pages[roles.otherOp].waitForTimeout(1_000);
    await expect(
      pages[roles.otherOp].locator("[data-last-landing]"),
    ).toHaveCount(0);

    // Finding both words for a clue of 2 celebrates a perfect clue for everyone.
    await cardButton(operative, second).click();
    await Promise.all(
      pages.map((page, i) => expectAnnounced(page, effects[i], "perfectClue")),
    );

    // Reactions float up on every screen, labelled with the sender.
    await pages[roles.otherOp]
      .getByRole("button", { name: "React 😱" })
      .click();
    await Promise.all(
      pages.map((page) =>
        expect(
          page
            .getByTestId("floating-reaction")
            .filter({ hasText: "😱" })
            .filter({ hasText: NAMES[roles.otherOp] }),
        ).toBeVisible(),
      ),
    );

    // Ending the turn swooshes the next team's ribbon across every screen.
    await operative
      .getByRole("button", { name: "End turn", exact: true })
      .click();
    await Promise.all(
      pages.map(async (page, i) => {
        const cue = await expectAnnounced(page, effects[i], "turnChange");
        expect(cue.team).not.toBe(activeTeam);
        await expect(page.locator("[data-last-banner-team]")).toHaveAttribute(
          "data-last-banner-team",
          String(cue.team),
        );
      }),
    );
  } finally {
    await game.close();
  }
});

test("the assassin flashes the screen, winners party, losers get rain, then recap and rematch", async ({
  browser,
}) => {
  const game = await startFourPlayerGame(browser);
  const { pages, states, effects, roles } = game;
  try {
    const assassin = states[roles.spy]()!.board.find(
      (card) => card.isAssassin,
    )!.word;
    await game.giveHint("Danger", 1);
    await cardButton(pages[roles.op], assassin).click();

    await Promise.all(
      pages.map(async (page, i) => {
        const strike = () =>
          effects[i].find((effect) => effect.type === "assassinReveal");
        await expect.poll(() => strike()?.id).toBeTruthy();
        await expect(
          page.locator(`[data-last-flash-id="${strike()!.id}"]`),
        ).toBeAttached();
        await expect(
          page.locator('[data-last-landing="assassin"]'),
        ).toHaveCount(1);
        const losers = i === roles.spy || i === roles.op;
        await expect(
          page.locator(`[data-celebration="${losers ? "lose" : "win"}"]`),
        ).toBeAttached();
      }),
    );

    // The recap lists the clue and what it led to, and hands out awards.
    for (const page of pages) {
      const recap = page.getByRole("region", { name: "Game recap" });
      await expect(recap).toBeVisible();
      await expect(recap.getByText("Danger · 1")).toBeVisible();
      await expect(recap.getByText(`${assassin} 💀`)).toBeVisible();
      await expect(recap.getByText("Found the assassin")).toBeVisible();
      await expect(recap.getByText(NAMES[roles.op])).toBeVisible();
    }

    // Rematch deals a fresh board for everyone.
    const previousBoard = states[0]()!.board
      .map((card) => card.word)
      .join();
    const firstStart = effects[0].find(
      (effect) => effect.type === "gameStart",
    )!;
    await pages[roles.otherOp]
      .getByRole("button", { name: "🔁 Rematch" })
      .click();
    await Promise.all(
      pages.map(async (page, i) => {
        const cue = await expect
          .poll(
            () =>
              effects[i].filter((effect) => effect.type === "gameStart").length,
          )
          .toBe(2)
          .then(() => expectAnnounced(page, effects[i], "gameStart"));
        expect(cue.id).not.toBe(firstStart.id);
      }),
    );
    for (let i = 0; i < pages.length; i++) {
      await expect.poll(() => states[i]()?.gameResult).toBeUndefined();
      await expect
        .poll(() =>
          states[i]()
            ?.board.map((card) => card.word)
            .join(),
        )
        .not.toBe(previousBoard);
      await expect(
        pages[i].getByRole("region", { name: "Game recap" }),
      ).toHaveCount(0);
    }
  } finally {
    await game.close();
  }
});

test("the room sees when the spymaster is thinking, and the timer gets a heartbeat", async ({
  browser,
}) => {
  // One watcher runs on a controllable clock so the turn timer can be fast-forwarded.
  let clockPage: Page | undefined;
  const game = await startFourPlayerGame(browser, async (page, index) => {
    if (index === 3) {
      clockPage = page;
      await page.clock.install();
    }
  });
  const { pages, roles } = game;
  try {
    const spyPage = pages[roles.spy];
    const hint = spyPage.getByPlaceholder("Hint word", { exact: true });
    await hint.pressSequentially("Oce");
    const thinking = /is cooking up a clue/;
    for (let i = 0; i < pages.length; i++) {
      if (i === roles.spy)
        await expect(pages[i].getByText(thinking)).toHaveCount(0);
      else await expect(pages[i].getByText(thinking)).toBeVisible();
    }
    await hint.fill("");
    for (const page of pages)
      await expect(page.getByText(thinking)).toHaveCount(0);
    await hint.pressSequentially("Ocean");
    await expect(pages[roles.op].getByText(thinking)).toBeVisible();
    await spyPage
      .getByRole("button", { name: "Give hint", exact: true })
      .click();
    for (const page of pages)
      await expect(page.getByText(thinking)).toHaveCount(0);

    // The ring turns urgent, the last ten seconds beat like a heart, zero buzzes.
    const page = clockPage!;
    const timer = page.locator("[data-urgency]");
    await expect(timer).toHaveAttribute("data-urgency", "calm");
    // Jump to just before the final stretch, then tick through it second by second.
    await page.clock.fastForward("01:40");
    const timerLabel = page.getByRole("timer");
    for (let second = 0; second < 30; second++) {
      await page.clock.runFor(1000);
      if (
        (await timerLabel.getAttribute("aria-label")) === "0 seconds remaining"
      )
        break;
    }
    await expect(timerLabel).toHaveAccessibleName("0 seconds remaining");
    await expect(timer).toHaveAttribute("data-urgency", "critical");
    const tones = await soundStarts(page);
    expect(
      tones.filter((tone) => tone.frequency === HEARTBEAT_HZ).length,
    ).toBeGreaterThanOrEqual(5);
    expect(tones.some((tone) => tone.frequency === BUZZER_HZ)).toBe(true);
  } finally {
    await game.close();
  }
});

test("the private reconnect token never reaches other players", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  await Promise.all(contexts.map(recordSounds));
  try {
    const [alice, bob] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    const aliceState = watchRoom(alice);
    const bobFrames = recordFrames(bob);
    const bobState = watchRoom(bob);
    const url = roomUrl();
    await alice.goto(url);
    await saveProfile(alice, "Alice Token");
    await bob.goto(url);
    await saveProfile(bob, "Bob Token");
    await expect.poll(() => bobState()?.players.length).toBe(2);

    const room = new URL(url, "http://localhost").searchParams.get("session")!;
    const token = await alice.evaluate(
      (key) => localStorage.getItem(key),
      `codenames:token:${room}`,
    );
    expect(token).toBeTruthy();
    expect(aliceState()!.playerId).not.toBe(token);
    expect(bobState()!.players.map((player) => player.id)).toContain(
      aliceState()!.playerId,
    );
    expect(bobFrames.some((frame) => frame.includes(token!))).toBe(false);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
