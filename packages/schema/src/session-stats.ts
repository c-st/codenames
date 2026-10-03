import type { SessionPlayer, SessionRound } from "./game";

export type HistoryAwardWinner =
  | ({ kind: "spymaster" } & SessionPlayer)
  | { kind: "team"; team: number };

export type HistoryAward = {
  id: string;
  title: string;
  emoji: string;
  description: string;
  valueLabel: string;
  winners: HistoryAwardWinner[];
  context: string;
};

export type HistoryStats = {
  completedCount: number;
  totalGuesses: number;
  correctGuesses: number;
  accuracy?: number;
  averageCompletedDuration?: number;
  teamWins: { team: number; wins: number }[];
  awards: HistoryAward[];
};

const variants: Record<string, readonly (readonly [string, string])[]> = {
  "spy-most-correct": [
    ["Clue Wizard", "🧙"],
    ["Word Whisperer", "🦉"],
    ["Brainwave Boss", "🧠"],
    ["Clue Conductor", "🎼"],
  ],
  "spy-accuracy": [
    ["Laser Brain", "🎯"],
    ["Precision Panda", "🐼"],
    ["Clue Compass", "🧭"],
    ["Bullseye Buddy", "🏹"],
  ],
  "spy-best-combo": [
    ["Combo Comet", "☄️"],
    ["Word Domino", "🎳"],
    ["Chain Reaction", "⚡"],
    ["Clue Cyclone", "🌀"],
  ],
  "spy-assassins": [
    ["Kaboom Captain", "💥"],
    ["Agent Yeeter", "🚀"],
    ["Explosive Expert", "🧨"],
    ["Boom Maestro", "🥁"],
  ],
  "team-most-correct": [
    ["Hive Mind", "🐝"],
    ["Brain Brigade", "🧠"],
    ["Word Wolves", "🐺"],
    ["Puzzle Posse", "🧩"],
  ],
  "team-hot-streak": [
    ["Hot Streak", "🔥"],
    ["Guess Express", "🚂"],
    ["Rocket Squad", "🚀"],
    ["On a Roll", "🎲"],
  ],
};

function awardStyle(seed: string, id: string) {
  let hash = 2166136261;
  for (const character of `${seed}:${id}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  const [title, emoji] = variants[id][hash % variants[id].length];
  return { title, emoji };
}

type SpyStats = {
  correct: number;
  guesses: number;
  assassins: number;
  combo: number;
};

const countLabel = (count: number, label: string) =>
  `${count} ${count === 1 ? label.replace("guesses", "guess") : label}`;

/** Team guesses are collective; only explicit spymaster snapshots attribute clues. */
export function calculateHistoryStats(
  rounds: readonly SessionRound[],
  roomSeed?: string,
): HistoryStats {
  let totalGuesses = 0;
  let correctGuesses = 0;
  let completedCount = 0;
  const durations: number[] = [];
  const wins = new Map<number, number>();
  const teamCorrect = new Map<number, number>();
  const teamStreaks = new Map<number, number>();
  const spies = new Map<string, SpyStats>();
  const identities = new Map<
    string,
    { player: SessionPlayer; timestamp: number }
  >();

  const remember = (player: SessionPlayer, timestamp: number) => {
    if (timestamp >= (identities.get(player.id)?.timestamp ?? -Infinity)) {
      identities.set(player.id, {
        player: { id: player.id, name: player.name, animal: player.animal },
        timestamp,
      });
    }
  };
  const spyStats = (player: SessionPlayer) => {
    let stats = spies.get(player.id);
    if (!stats) {
      stats = { correct: 0, guesses: 0, assassins: 0, combo: 0 };
      spies.set(player.id, stats);
    }
    return stats;
  };

  for (const round of rounds) {
    for (let team = 0; team < round.teamCount; team++)
      if (!wins.has(team)) wins.set(team, 0);
    for (const player of round.players) remember(player, round.startedAt);
    if (round.status === "completed") {
      completedCount++;
      if (
        round.endedAt !== undefined &&
        Number.isFinite(round.endedAt - round.startedAt) &&
        round.endedAt >= round.startedAt
      )
        durations.push(round.endedAt - round.startedAt);
      if (round.result?.winningTeam !== undefined)
        wins.set(
          round.result.winningTeam,
          (wins.get(round.result.winningTeam) ?? 0) + 1,
        );
    }
    const streaks = new Map<number, number>();
    let clue: { team: number; spyId?: string; correct: number } | undefined;
    // Copy before sorting: callers retain their original history and event order.
    for (const event of [...round.events].sort(
      (a, b) => a.timestamp - b.timestamp,
    )) {
      if (event.spymaster) remember(event.spymaster, event.timestamp);
      if (event.type === "hint") {
        clue = { team: event.team, spyId: event.spymaster?.id, correct: 0 };
        continue;
      }
      totalGuesses++;
      const correct = event.outcome === "correct";
      if (correct) {
        correctGuesses++;
        teamCorrect.set(event.team, (teamCorrect.get(event.team) ?? 0) + 1);
        const streak = (streaks.get(event.team) ?? 0) + 1;
        streaks.set(event.team, streak);
        teamStreaks.set(
          event.team,
          Math.max(teamStreaks.get(event.team) ?? 0, streak),
        );
      } else {
        streaks.set(event.team, 0);
      }
      if (event.spymaster) {
        const stats = spyStats(event.spymaster);
        stats.guesses++;
        if (correct) stats.correct++;
        if (event.outcome === "assassin") stats.assassins++;
        if (
          clue?.team === event.team &&
          clue.spyId === event.spymaster.id &&
          correct
        ) {
          clue.correct++;
          stats.combo = Math.max(stats.combo, clue.correct);
        }
      }
      // A failed guess ends its clue, even if the next retained event is a guess.
      if (!correct || (clue && clue.team !== event.team)) clue = undefined;
    }
  }

  const awards: HistoryAward[] = [];
  const seed = roomSeed ?? rounds[0]?.id ?? "empty";
  const spyWinner = (id: string): HistoryAwardWinner => ({
    kind: "spymaster",
    ...identities.get(id)!.player,
  });
  function addSpyAward(
    id: string,
    metric: keyof SpyStats,
    description: string,
    unit: string,
    context: string,
  ) {
    const best = Math.max(0, ...[...spies.values()].map((spy) => spy[metric]));
    if (!best) return;
    awards.push({
      id,
      ...awardStyle(seed, id),
      description,
      valueLabel: countLabel(best, unit),
      winners: [...spies]
        .filter(([, spy]) => spy[metric] === best)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([playerId]) => spyWinner(playerId)),
      context,
    });
  }
  function addTeamAward(
    id: string,
    values: Map<number, number>,
    description: string,
    unit: string,
    context: string,
  ) {
    const best = Math.max(0, ...values.values());
    if (!best) return;
    awards.push({
      id,
      ...awardStyle(seed, id),
      description,
      valueLabel: countLabel(best, unit),
      winners: [...values]
        .filter(([, value]) => value === best)
        .sort(([a], [b]) => a - b)
        .map(([team]) => ({ kind: "team", team })),
      context,
    });
  }

  addSpyAward(
    "spy-most-correct",
    "correct",
    "Most correct team guesses attributed to a spymaster.",
    "correct guesses",
    "Across all retained rounds",
  );
  const eligible = [...spies].filter(
    ([, spy]) => spy.guesses >= 3 && spy.correct > 0,
  );
  let accuracyLeaders: typeof eligible = [];
  for (const entry of eligible) {
    const best = accuracyLeaders[0]?.[1];
    const comparison = best
      ? entry[1].correct * best.guesses - best.correct * entry[1].guesses
      : 1;
    if (comparison > 0) accuracyLeaders = [entry];
    else if (comparison === 0) accuracyLeaders.push(entry);
  }
  if (accuracyLeaders.length)
    awards.push({
      id: "spy-accuracy",
      ...awardStyle(seed, "spy-accuracy"),
      description:
        "Highest correct-guess rate for a spymaster with at least 3 attributed guesses.",
      valueLabel: `${Math.round((accuracyLeaders[0][1].correct / accuracyLeaders[0][1].guesses) * 100)}% accuracy`,
      winners: accuracyLeaders
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id]) => spyWinner(id)),
      context: "Only guesses with an explicit spymaster snapshot count",
    });
  addSpyAward(
    "spy-best-combo",
    "combo",
    "Most correct team guesses from a single clue.",
    "correct guesses in one clue",
    "A new clue or failed guess ends the combo",
  );
  addSpyAward(
    "spy-assassins",
    "assassins",
    "Most assassin guesses attributed to a spymaster's clues.",
    "assassin guesses",
    "A playful mishap award; team guesses are collective",
  );
  const assassinAward = awards.find((entry) => entry.id === "spy-assassins");
  if (assassinAward)
    assassinAward.context = assassinAward.winners
      .map((winner) => {
        if (winner.kind !== "spymaster") return "";
        const stats = spies.get(winner.id)!;
        return `${winner.name}: ${countLabel(stats.assassins, "assassin guesses")} / ${countLabel(stats.guesses, "attributed guesses")} (${Math.round((stats.assassins / stats.guesses) * 100)}%)`;
      })
      .join(" · ");
  addTeamAward(
    "team-most-correct",
    teamCorrect,
    "Most correct guesses by a team.",
    "correct guesses",
    "Shared by the whole team across retained rounds",
  );
  addTeamAward(
    "team-hot-streak",
    teamStreaks,
    "Longest run of correct guesses by a team in one round.",
    "correct guesses in a row",
    "Other teams' guesses do not interrupt your team's streak",
  );

  return {
    completedCount,
    totalGuesses,
    correctGuesses,
    accuracy: totalGuesses
      ? Math.round((correctGuesses / totalGuesses) * 100)
      : undefined,
    averageCompletedDuration: durations.length
      ? Math.round(
          durations.reduce((sum, duration) => sum + duration, 0) /
            durations.length,
        )
      : undefined,
    teamWins: [...wins]
      .sort(([a], [b]) => a - b)
      .map(([team, count]) => ({ team, wins: count })),
    awards,
  };
}
