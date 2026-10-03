import type { SessionEvent, SessionPlayer, SessionRound } from "./game";
import { calculateHistoryStats } from "./session-stats";

const alice: SessionPlayer = { id: "alice", name: "Alice", animal: "🦊" };
const bob: SessionPlayer = { id: "bob", name: "Bob", animal: "🐼" };
const hint = (
  team: number,
  spymaster: SessionPlayer | undefined,
  timestamp = 1,
): SessionEvent => ({
  type: "hint",
  timestamp,
  team,
  hint: "clue",
  count: 3,
  spymaster,
});
const guess = (
  team: number,
  outcome: "correct" | "neutral" | "opponent" | "assassin",
  spymaster?: SessionPlayer,
  timestamp = 2,
): SessionEvent => ({
  type: "guess",
  timestamp,
  team,
  word: `word-${timestamp}`,
  outcome,
  spymaster,
});
const round = (overrides: Partial<SessionRound> = {}): SessionRound => ({
  id: "round-1",
  startedAt: 0,
  status: "active",
  wordPack: "classic",
  teamCount: 2,
  players: [],
  events: [],
  ...overrides,
});
const award = (rounds: SessionRound[], id: string) =>
  calculateHistoryStats(rounds).awards.find((entry) => entry.id === id);

describe("session history statistics", () => {
  it("returns empty metrics and no invented awards for empty or zero-guess histories", () => {
    expect(calculateHistoryStats([])).toEqual({
      completedCount: 0,
      totalGuesses: 0,
      correctGuesses: 0,
      accuracy: undefined,
      averageCompletedDuration: undefined,
      teamWins: [],
      awards: [],
    });
    expect(
      calculateHistoryStats([round({ events: [hint(0, alice)] })]).awards,
    ).toEqual([]);
  });

  it("counts retained guesses from active and aborted games, but durations and wins only from completed games", () => {
    const stats = calculateHistoryStats([
      round({ id: "active", events: [guess(0, "correct")] }),
      round({
        id: "aborted",
        status: "aborted",
        endedAt: 9000,
        events: [guess(0, "neutral")],
        result: { winningTeam: 1 },
      }),
      round({
        id: "complete",
        status: "completed",
        endedAt: 1000,
        events: [guess(1, "correct")],
        result: { winningTeam: 1 },
      }),
      round({
        id: "loss-only",
        startedAt: 1000,
        endedAt: 3000,
        status: "completed",
        result: { losingTeam: 0 },
      }),
    ]);
    expect(stats).toMatchObject({
      completedCount: 2,
      totalGuesses: 3,
      correctGuesses: 2,
      accuracy: 67,
      averageCompletedDuration: 1500,
      teamWins: [
        { team: 0, wins: 0 },
        { team: 1, wins: 1 },
      ],
    });
  });

  it("counts assassins as failures and awards only explicitly attributed spymasters", () => {
    const rounds = [
      round({
        events: [
          hint(0, alice),
          guess(0, "assassin", alice),
          guess(1, "assassin"),
        ],
      }),
    ];
    expect(calculateHistoryStats(rounds)).toMatchObject({
      totalGuesses: 2,
      correctGuesses: 0,
      accuracy: 0,
    });
    expect(award(rounds, "spy-assassins")).toMatchObject({
      valueLabel: "1 assassin guess",
      winners: [{ kind: "spymaster", ...alice }],
    });
    expect(award(rounds, "spy-assassins")?.context).toBe(
      "Alice: 1 assassin guess / 1 attributed guess (100%)",
    );
    expect(
      calculateHistoryStats(rounds).awards.map((entry) => entry.id),
    ).toEqual(["spy-assassins"]);
  });

  it("shares team credit without creating operative awards or inferring missing spymaster attribution", () => {
    const rounds = [
      round({
        players: [{ ...alice, team: 0, role: "operative" }],
        events: [hint(0, alice), guess(0, "correct"), guess(0, "correct")],
      }),
    ];
    expect(
      calculateHistoryStats(rounds).awards.map((entry) => entry.id),
    ).toEqual(["team-most-correct", "team-hot-streak"]);
    expect(award(rounds, "team-most-correct")?.winners).toEqual([
      { kind: "team", team: 0 },
    ]);
    expect(award(rounds, "team-hot-streak")?.valueLabel).toBe(
      "2 correct guesses in a row",
    );
  });

  it("preserves all ties, stable identities, and the most recent display name", () => {
    const renamed = { ...alice, name: "Alice renamed", animal: "🦉" as const };
    const rounds = [
      round({
        events: [
          hint(0, alice),
          guess(0, "correct", alice, 2),
          hint(1, bob, 3),
          guess(1, "correct", bob, 4),
        ],
      }),
      round({
        id: "later",
        startedAt: 100,
        players: [{ ...renamed, team: 0, role: "operative" }],
      }),
    ];
    expect(award(rounds, "spy-most-correct")?.winners).toEqual([
      { kind: "spymaster", ...renamed },
      { kind: "spymaster", ...bob },
    ]);
    expect(award(rounds, "team-most-correct")?.winners).toEqual([
      { kind: "team", team: 0 },
      { kind: "team", team: 1 },
    ]);
  });

  it("requires three attributed guesses for accuracy and compares exact rates before rounding", () => {
    expect(
      award(
        [
          round({
            events: [guess(0, "correct", alice), guess(0, "correct", alice)],
          }),
        ],
        "spy-accuracy",
      ),
    ).toBeUndefined();
    const rounds = [
      round({
        events: [
          guess(0, "correct", alice, 1),
          guess(0, "correct", alice, 2),
          guess(0, "neutral", alice, 3),
          ...Array.from({ length: 6 }, (_, index) =>
            guess(1, index < 4 ? "correct" : "neutral", bob, 4 + index),
          ),
        ],
      }),
    ];
    expect(award(rounds, "spy-accuracy")).toMatchObject({
      valueLabel: "67% accuracy",
      winners: [
        { kind: "spymaster", ...alice },
        { kind: "spymaster", ...bob },
      ],
    });
  });

  it("bounds clue combos at new clues across teams, failed guesses, and spymaster changes", () => {
    const rounds = [
      round({
        events: [
          hint(0, alice, 1),
          guess(0, "correct", alice, 2),
          guess(0, "correct", alice, 3),
          hint(1, bob, 4),
          guess(1, "correct", bob, 5),
          guess(0, "correct", alice, 6),
          hint(0, alice, 7),
          guess(0, "correct", bob, 8),
          guess(0, "neutral", alice, 9),
          guess(0, "correct", alice, 10),
        ],
      }),
    ];
    expect(award(rounds, "spy-best-combo")).toMatchObject({
      valueLabel: "2 correct guesses in one clue",
      winners: [{ kind: "spymaster", ...alice }],
    });
  });

  it("does not award a false tie when different accuracy rates round to the same percent", () => {
    const rounds = [
      round({
        events: [
          guess(0, "correct", alice, 1),
          guess(0, "neutral", alice, 2),
          guess(0, "neutral", alice, 3),
          ...Array.from({ length: 100 }, (_, index) =>
            guess(1, index < 33 ? "correct" : "neutral", bob, index + 4),
          ),
        ],
      }),
    ];
    expect(award(rounds, "spy-accuracy")).toMatchObject({
      valueLabel: "33% accuracy",
      winners: [{ kind: "spymaster", ...alice }],
    });
  });

  it("resets team streaks on that team's failures and at round boundaries", () => {
    const rounds = [
      round({
        events: [
          guess(0, "correct", undefined, 1),
          guess(1, "neutral", undefined, 2),
          guess(0, "correct", undefined, 3),
          guess(0, "neutral", undefined, 4),
          guess(0, "correct", undefined, 5),
        ],
      }),
      round({ id: "second", events: [guess(0, "correct")] }),
    ];
    expect(award(rounds, "team-hot-streak")?.valueLabel).toBe(
      "2 correct guesses in a row",
    );
  });

  it("uses deterministic title and emoji variants, stable category ordering, and never mutates input", () => {
    const rounds = [
      round({
        events: [
          guess(0, "assassin", alice, 6),
          guess(0, "correct", alice, 4),
          hint(0, alice, 1),
          guess(0, "correct", alice, 2),
          guess(0, "correct", alice, 3),
        ],
      }),
    ];
    const snapshot = JSON.stringify(rounds);
    const first = calculateHistoryStats(rounds);
    expect(calculateHistoryStats(rounds)).toEqual(first);
    expect(first.awards.map((entry) => entry.id)).toEqual([
      "spy-most-correct",
      "spy-accuracy",
      "spy-best-combo",
      "spy-assassins",
      "team-most-correct",
      "team-hot-streak",
    ]);
    expect(
      first.awards.every(
        (entry) =>
          entry.title && entry.emoji && entry.description && entry.context,
      ),
    ).toBe(true);
    expect(JSON.stringify(rounds)).toBe(snapshot);
    const titles = new Set(
      Array.from(
        { length: 20 },
        (_, index) =>
          award(
            [
              round({
                id: `seed-${index}`,
                events: [guess(0, "correct", alice)],
              }),
            ],
            "spy-most-correct",
          )?.title,
      ),
    );
    expect(titles.size).toBeGreaterThan(1);
  });
  it("keeps room titles through rematches and history pruning", () => {
    const first = round({ id: "first", events: [guess(0, "correct", alice)] });
    const rematch = round({
      id: "rematch",
      events: [guess(0, "correct", alice)],
    });
    const styles = (rounds: SessionRound[], seed: string) =>
      calculateHistoryStats(rounds, seed).awards.map(
        ({ id, title, emoji }) => ({ id, title, emoji }),
      );
    expect(styles([first, rematch], "room-home")).toEqual(
      styles([first], "room-home"),
    );
    expect(styles([rematch], "room-home")).toEqual(
      styles([first], "room-home"),
    );
    const roomTitles = new Set(
      Array.from({ length: 20 }, (_, index) =>
        JSON.stringify(styles([first], `room-${index}`)),
      ),
    );
    expect(roomTitles.size).toBeGreaterThan(1);
  });
});
