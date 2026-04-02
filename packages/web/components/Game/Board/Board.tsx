import { useEffect, useState } from "react";
import { GameResult, HintHistory, Player, Turn, WordCard } from "schema";
import { AnimatePresence, motion } from "motion/react";
import { useWarnBeforeReloading } from "@/components/hooks/useWarnBeforeReloading";
import HintInput from "./HintInput";
import { getTeamColor, getTeamName } from "./getTeamColor";
import TeamInfo from "./TeamInfo";
import { getSpymasterTitle } from "../spymasterTitle";

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
    return `Waiting for your ${getSpymasterTitle()}'s hint...`;
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
        {gameResult && <Result gameResult={gameResult} players={players} />}
        {gameResult === undefined && <Timer until={until} />}
      </div>
      <WordMatrix
        isGameOver={!!gameResult}
        words={words}
        turn={turn}
        currentPlayer={currentPlayer}
        onRevealWord={revealWord}
      />
      {previousHints && (
        <div className="rounded-xl bg-surface/50 px-4 py-2 font-mono text-base font-medium text-purple-300/60">
          Previous: {previousHints}
        </div>
      )}
    </div>
  );
}

function Result({
  gameResult,
  players,
}: {
  gameResult?: GameResult;
  players: Player[];
}) {
  const { winningTeam, losingTeam } = gameResult || {};
  const isWin = winningTeam !== undefined;
  const resultTeam = winningTeam ?? losingTeam;
  const color = resultTeam !== undefined ? getTeamColor(resultTeam) : null;
  const teamPlayers = resultTeam !== undefined
    ? players.filter((p) => p.team === resultTeam)
    : [];

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      {/* Trophy / skull */}
      <motion.div
        className="text-6xl"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.2 }}
      >
        {isWin ? "🏆" : "💀"}
      </motion.div>

      {/* Headline */}
      <motion.h2
        className="select-none text-center text-3xl font-black md:text-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
      >
        {isWin ? `Team ${getTeamName(winningTeam!)} wins!` : `Team ${getTeamName(losingTeam!)} loses...`}
      </motion.h2>

      {/* Winning podium */}
      {teamPlayers.length > 0 && color && (
        <motion.div
          className={`flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-8 py-5 shadow-xl`}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.4 }}
        >
          <div className="flex gap-3">
            {teamPlayers.map((player, i) => (
              <motion.div
                key={player.id}
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 15,
                  delay: 0.5 + i * 0.1,
                }}
              >
                <motion.span
                  className="select-none text-3xl md:text-4xl"
                  animate={isWin ? { y: [0, -8, 0] } : {}}
                  transition={{
                    repeat: isWin ? 2 : 0,
                    duration: 0.4,
                    delay: 0.7 + i * 0.15,
                  }}
                >
                  {player.name.split(" ")[0]}
                </motion.span>
                <span className="max-w-20 truncate text-center text-xs font-semibold !text-white/80">
                  {player.name.split(" ").slice(1).join(" ") || player.name}
                </span>
                <span className={`text-[0.6rem] font-bold ${player.role === "spymaster" ? "text-amber-300" : "text-white/50"}`}>
                  {player.role === "spymaster" ? getSpymasterTitle() : "Operative"}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
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
          <motion.div
            key={turn.hint.hint}
            className="flex items-baseline gap-2"
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <span className="font-mono text-2xl font-bold">
              {turn.hint.hint} ({turn.hint.count})
            </span>
            {turn.guessesRemaining !== undefined && (
              <span className="text-sm text-purple-400">
                {turn.guessesRemaining} guess{turn.guessesRemaining !== 1 ? "es" : ""} left
              </span>
            )}
          </motion.div>
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
  let textColor = "!text-[#1a1530]";

  if (showWord) {
    if (wordCard.isAssassin) {
      bgColor = "bg-gradient-to-br from-red-600 to-red-400 card-shadow-assassin";
      textColor = "!text-white";
    } else if (wordCard.team !== undefined) {
      const color = getTeamColor(wordCard.team);
      bgColor = `bg-gradient-to-br ${color.from} ${color.to} ${color.shadow}`;
      textColor = "!text-white";
    } else {
      bgColor = "bg-[#3a3550] card-shadow-neutral";
      textColor = "!text-[#8078a0]";
    }
  }

  const opacity =
    !wordCard.revealed && (isSpymaster || isGameOver) ? 0.5 : 0.95;

  return (
    <motion.div
      key={wordCard.word}
      className={`flex h-14 flex-col items-center justify-center rounded-[14px] p-2 md:h-24 md:p-4 lg:p-8 ${wordCard.revealed || isGameOver ? "cursor-default" : "cursor-pointer"} ${bgColor}`}
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
        className={`text-xs font-extrabold ${textColor} select-none text-center md:text-base lg:text-xl`}
      >
        {wordCard.word}
      </p>
    </motion.div>
  );
}
