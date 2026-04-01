import { useEffect, useState } from "react";
import { GameResult, HintHistory, Player, Turn, WordCard } from "schema";
import { AnimatePresence, motion } from "motion/react";
import { useWarnBeforeReloading } from "@/components/hooks/useWarnBeforeReloading";
import HintInput from "./HintInput";
import { getTeamColor } from "./getTeamColor";
import TeamInfo from "./TeamInfo";

export default function Board({
  isConnected,
  players,
  currentPlayerId,
  words,
  turn,
  hintHistory,
  remainingWordsByTeam,
  gameResult,
  giveHint,
  revealWord,
}: {
  isConnected: boolean;
  players: Player[];
  currentPlayerId: string;
  words?: WordCard[];
  turn: Turn;
  hintHistory: HintHistory;
  remainingWordsByTeam: number[];
  gameResult?: GameResult;
  gameCanBeStarted: boolean;
  startGame: () => void;
  giveHint: (hint: string, count: number) => void;
  revealWord: (word: string) => void;
  endTurn: () => void;
  endGame: () => void;
}) {
  useWarnBeforeReloading(isConnected);

  const { until } = turn;

  const previousHints = hintHistory
    .filter((e) => e.team === turn.team)
    .reverse()
    .slice(turn.hint ? 1 : 0)
    .map((e) => e.hint)
    .join(", ");

  if (words === undefined) {
    return null;
  }
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) {
    return null;
  }

  const isCurrentTurn = currentPlayer.team === turn.team;

  // Build status message
  const statusMessage = (() => {
    if (gameResult) return null;
    if (!isCurrentTurn) return "Waiting for the other team...";
    if (currentPlayer.role === "spymaster" && !turn.hint) return "Your turn — give a hint!";
    if (currentPlayer.role === "spymaster" && turn.hint) return "Your team is guessing...";
    if (turn.hint) return "Your turn — tap a word to guess!";
    return "Waiting for your Spymaster's hint...";
  })();

  return (
    <div className="flex flex-col gap-4">
      <TeamInfo
        isGameOver={!!gameResult}
        players={players}
        currentPlayer={currentPlayer}
        turn={turn}
        remainingWordsByTeam={remainingWordsByTeam}
      />
      {statusMessage && (
        <motion.div
          key={statusMessage}
          className={`rounded-2xl px-4 py-3 text-center text-lg font-bold ${
            isCurrentTurn
              ? "bg-accent/20 text-accent"
              : "bg-surface text-purple-400/70"
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {statusMessage}
        </motion.div>
      )}
      <div className="flex justify-between">
        {!gameResult && (
          <Hint
            turn={turn}
            giveHint={giveHint}
            isCurrentlySpymaster={
              currentPlayer.role === "spymaster" && isCurrentTurn
            }
          />
        )}
        {gameResult && <Result gameResult={gameResult} />}
        {gameResult === undefined && <Timer until={until} />}
      </div>
      <WordMatrix
        isGameOver={!!gameResult}
        words={words}
        turn={turn}
        currentPlayer={currentPlayer}
        onRevealWord={revealWord}
      />
      <div className="font-mono text-lg font-medium text-purple-300/60">
        {previousHints}
      </div>
    </div>
  );
}

function Result({ gameResult }: { gameResult?: GameResult }) {
  const { winningTeam, losingTeam } = gameResult || {};
  return (
    <motion.span
      className="text-2xl font-bold"
      initial={{ opacity: 0, scale: 0.5, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
    >
      {winningTeam !== undefined && `Team ${winningTeam} wins! 🎉`}
      {losingTeam !== undefined && `Team ${losingTeam} loses... 💀`}
    </motion.span>
  );
}

function Hint({
  turn,
  giveHint,
  isCurrentlySpymaster,
}: {
  turn: Turn;
  giveHint: (hint: string, count: number) => void;
  isCurrentlySpymaster: boolean;
}) {
  return (
    <div>
      <AnimatePresence mode="wait">
        {turn.hint ? (
          <motion.p
            key={turn.hint.hint}
            className="font-mono text-2xl font-bold"
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {turn.hint.hint} ({turn.hint.count})
          </motion.p>
        ) : (
          isCurrentlySpymaster && (
            <motion.div
              key="hint-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <HintInput giveHint={giveHint} />
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}

function Timer({ until }: { until: Date }) {
  const [timeLeft, setTimeLeft] = useState({ minutes: "0", seconds: "00" });

  useEffect(() => {
    const timer = setInterval(() => {
      const difference = +new Date(until) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          minutes: Math.floor((difference / (1000 * 60)) % 60).toString(),
          seconds: Math.floor((difference / 1000) % 60)
            .toString()
            .padStart(2, "0"),
        });
      } else {
        setTimeLeft({ minutes: "0", seconds: "00" });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [until]);

  return (
    <div className="flex items-center">
      <span className="select-none font-mono text-2xl text-purple-300">
        {timeLeft.minutes}:{timeLeft.seconds}
      </span>
    </div>
  );
}

function WordMatrix({
  isGameOver,
  words,
  currentPlayer,
  turn,
  onRevealWord,
}: {
  isGameOver: boolean;
  words: WordCard[];
  currentPlayer: Player;
  turn: Turn;
  onRevealWord: (word: string) => void;
}) {
  const teamColor = getTeamColor(turn.team);

  return (
    <div
      className={`grid grid-cols-5 grid-rows-5 gap-2 rounded-2xl border-8 border-solid ${teamColor.border} p-2`}
    >
      {words.map((wordCard, index) => (
        <Word
          isGameOver={isGameOver}
          key={wordCard.word}
          wordCard={wordCard}
          currentPlayer={currentPlayer}
          onRevealWord={onRevealWord}
          index={index}
        />
      ))}
    </div>
  );
}

function Word({
  isGameOver,
  wordCard,
  currentPlayer,
  onRevealWord,
  index = 0,
}: {
  isGameOver: boolean;
  wordCard: WordCard;
  currentPlayer: Player;
  onRevealWord: (word: string) => void;
  index?: number;
}) {
  const isSpymaster = currentPlayer.role === "spymaster";
  const showWord = !!wordCard.revealed || isSpymaster || isGameOver;

  let bgColor = "bg-[#f5f0ff] card-shadow-default";
  let textColor = "text-[#1a1530]";

  if (showWord) {
    if (wordCard.isAssassin) {
      bgColor = "bg-gradient-to-br from-red-600 to-red-400 card-shadow-assassin";
      textColor = "text-white";
    } else if (wordCard.team !== undefined) {
      const color = getTeamColor(wordCard.team);
      bgColor = `bg-gradient-to-br ${color.from} ${color.to} ${color.shadow}`;
      textColor = "text-white";
    } else {
      bgColor = "bg-[#3a3550] card-shadow-neutral";
      textColor = "text-[#8078a0]";
    }
  }

  const opacity =
    !wordCard.revealed && (isSpymaster || isGameOver) ? 0.5 : 0.95;

  return (
    <motion.div
      key={wordCard.word}
      className={`flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] p-4 lg:p-8 ${bgColor}`}
      onClick={() => onRevealWord(wordCard.word)}
      whileHover={{ scale: 1.08, y: -3 }}
      whileTap={{ scale: 0.9 }}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 1.5, y: -20 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 15,
        delay: index * 0.02,
      }}
    >
      <p
        className={`text-m font-extrabold ${textColor} select-none text-center md:text-xl`}
      >
        {wordCard.word}
      </p>
    </motion.div>
  );
}
