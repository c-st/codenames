import { motion } from "motion/react";
import { HintHistory, Player, WordCard } from "schema";
import { getTeamColor } from "./getTeamColor";

type Award = { emoji: string; title: string; who: string; detail: string };

const playerLabel = (players: Player[], id?: string) => {
  const player = players.find((p) => p.id === id);
  return player ? `${player.animal ?? "🐾"} ${player.name}` : undefined;
};

function topBy<T>(items: T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  for (const item of items)
    if (score(item) > 0 && (!best || score(item) > score(best))) best = item;
  return best;
}

export function computeAwards(
  board: WordCard[],
  hintHistory: HintHistory,
  players: Player[],
): Award[] {
  const awards: Award[] = [];
  const spymasterOf = (team: number) =>
    playerLabel(
      players,
      players.find((p) => p.team === team && p.role === "spymaster")?.id,
    ) ?? "A spymaster";
  const guessesFor = (inTurn: number) =>
    board.filter((card) => card.revealed?.inTurn === inTurn + 1);

  // A wrong guess ends the turn, so reaching the count means the first guesses were all correct.
  const perfect = topBy(hintHistory, (hint) =>
    hint.count > 0 &&
    guessesFor(hint.inTurn).filter((card) => card.team === hint.team).length >=
      hint.count
      ? hint.count
      : 0,
  );
  if (perfect)
    awards.push({
      emoji: "🧠",
      title: "Mind reader",
      who: spymasterOf(perfect.team),
      detail: `“${perfect.hint}” for ${perfect.count}, nailed it`,
    });

  const boldest = topBy(hintHistory, (hint) => hint.count);
  if (boldest && boldest.count >= 3 && boldest !== perfect) {
    awards.push({
      emoji: "🦁",
      title: "Boldest clue",
      who: spymasterOf(boldest.team),
      detail: `“${boldest.hint}” for ${boldest.count}`,
    });
  }

  const tally = (predicate: (card: WordCard) => boolean) => {
    const counts = new Map<string, number>();
    for (const card of board) {
      const by = card.revealed?.byPlayer;
      if (by && predicate(card)) counts.set(by, (counts.get(by) ?? 0) + 1);
    }
    return topBy([...counts], ([, count]) => count);
  };
  const sharpshooter = tally((card) => card.team === card.revealed?.byTeam);
  const sharpLabel = playerLabel(players, sharpshooter?.[0]);
  if (sharpshooter && sharpLabel)
    awards.push({
      emoji: "🎯",
      title: "Sharpshooter",
      who: sharpLabel,
      detail: `${sharpshooter[1]} correct guess${sharpshooter[1] === 1 ? "" : "es"}`,
    });

  const oops = tally(
    (card) => !card.isAssassin && card.team !== card.revealed?.byTeam,
  );
  const oopsLabel = playerLabel(players, oops?.[0]);
  if (oops && oopsLabel)
    awards.push({
      emoji: "🙈",
      title: "Creative interpreter",
      who: oopsLabel,
      detail: `${oops[1]} surprising pick${oops[1] === 1 ? "" : "s"}`,
    });

  const assassin = board.find((card) => card.isAssassin && card.revealed);
  const assassinLabel = playerLabel(players, assassin?.revealed?.byPlayer);
  if (assassin && assassinLabel)
    awards.push({
      emoji: "💀",
      title: "Found the assassin",
      who: assassinLabel,
      detail: `“${assassin.word}”. Bold move.`,
    });

  return awards;
}

function cardStyle(card: WordCard) {
  if (card.isAssassin) return "bg-red-600 !text-white";
  if (card.team === undefined) return "bg-[#3a3550] !text-[#b0a8d0]";
  const color = getTeamColor(card.team);
  return `bg-gradient-to-br ${color.from} ${color.to} !text-white`;
}

/** After the game: every clue, what it led to, and some silly awards. */
export default function GameRecap({
  board,
  hintHistory,
  players,
}: {
  board: WordCard[];
  hintHistory: HintHistory;
  players: Player[];
}) {
  const awards = computeAwards(board, hintHistory, players);
  if (!hintHistory.length && !awards.length) return null;

  return (
    <motion.section
      aria-label="Game recap"
      className="flex w-full flex-col gap-4 rounded-2xl bg-surface/60 p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 22 }}
    >
      {awards.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {awards.map((award, i) => (
            <motion.div
              key={award.title}
              className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2"
              initial={{ opacity: 0, scale: 0.8, rotate: -3 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{
                delay: 1.1 + i * 0.15,
                type: "spring",
                stiffness: 300,
                damping: 18,
              }}
            >
              <span className="select-none text-3xl">{award.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
                  {award.title}
                </p>
                <p className="truncate font-bold !text-white">{award.who}</p>
                <p className="truncate text-xs text-purple-300/80">
                  {award.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {hintHistory.length > 0 && (
        <ol className="flex flex-col gap-2">
          {hintHistory.map((hint) => {
            const color = getTeamColor(hint.team);
            const guesses = board.filter(
              (card) => card.revealed?.inTurn === hint.inTurn + 1,
            );
            return (
              <li
                key={hint.inTurn}
                className="flex flex-wrap items-center gap-1.5"
              >
                <span
                  className={`rounded-full bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-3 py-1 font-mono text-sm font-bold !text-white`}
                >
                  {hint.hint} · {hint.count}
                </span>
                <span className="text-purple-400/60">→</span>
                {guesses.length === 0 && (
                  <span className="text-xs italic text-purple-400/60">
                    no guesses
                  </span>
                )}
                {guesses.map((card) => (
                  <span
                    key={card.word}
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${cardStyle(card)}`}
                  >
                    {card.word}{" "}
                    {card.isAssassin
                      ? "💀"
                      : card.team === hint.team
                        ? "✓"
                        : "✗"}
                  </span>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </motion.section>
  );
}
