import { useEffect, useState } from "react";
import { GameResult, HintHistory, Player, Turn, WordCard } from "schema";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
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
    if (!isConnected)
      return "Reconnecting — guesses will resume when connected.";
    if (!isCurrentTurn) return "Waiting for the other team...";
    if (currentPlayer.role === "spymaster" && !turn.hint)
      return "Your turn — give a hint!";
    if (currentPlayer.role === "spymaster" && turn.hint)
      return "Your team is guessing...";
    if (turn.hint) return "Your turn — tap a word to guess!";
    return `Waiting for your ${getSpymasterTitle()}'s hint...`;
  })();

  return (
    <MotionConfig reducedMotion="user">
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
            role="status"
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
        <div className="flex items-start justify-between gap-3">
          {!gameResult && (
            <Hint
              turn={turn}
              giveHint={giveHint}
              isCurrentlySpymaster={
                isConnected &&
                currentPlayer.role === "spymaster" &&
                isCurrentTurn
              }
            />
          )}
          {gameResult && <Result gameResult={gameResult} players={players} />}
          {gameResult === undefined && (
            <Timer key={+new Date(until)} until={until} />
          )}
        </div>
        <WordMatrix
          canGuess={
            isConnected &&
            !gameResult &&
            isCurrentTurn &&
            currentPlayer.role === "operative" &&
            !!turn.hint &&
            (turn.guessesRemaining === undefined || turn.guessesRemaining > 0)
          }
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
    </MotionConfig>
  );
}

function Result({
  gameResult,
  players,
}: {
  gameResult?: GameResult;
  players: Player[];
}) {
  const reduceMotion = useReducedMotion();
  const { winningTeam, losingTeam } = gameResult || {};
  const isWin = winningTeam !== undefined;
  const resultTeam = winningTeam ?? losingTeam;
  const color = resultTeam !== undefined ? getTeamColor(resultTeam) : null;
  const teamPlayers =
    resultTeam !== undefined
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
        initial={{ scale: 0.85, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.1 }}
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
        {isWin
          ? `Team ${getTeamName(winningTeam!)} wins!`
          : `Team ${getTeamName(losingTeam!)} loses...`}
      </motion.h2>

      {/* Winning podium */}
      {teamPlayers.length > 0 && color && (
        <motion.div
          className={`flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-8 py-5 shadow-xl`}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.4,
          }}
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
                  damping: 24,
                  delay: 0.3 + Math.min(i, 5) * 0.04,
                }}
              >
                <motion.span
                  className="select-none text-3xl md:text-4xl"
                  animate={isWin && !reduceMotion ? { y: [0, -4, 0] } : {}}
                  transition={{
                    repeat: isWin ? 2 : 0,
                    duration: 0.4,
                    delay: 0.7 + i * 0.15,
                  }}
                >
                  {player.animal || "🐾"}
                </motion.span>
                <span className="max-w-20 truncate text-center text-xs font-semibold !text-white/80">
                  {player.name}
                </span>
                <span
                  className={`text-[0.6rem] font-bold ${player.role === "spymaster" ? "text-amber-300" : "text-white/50"}`}
                >
                  {player.role === "spymaster"
                    ? getSpymasterTitle()
                    : "Operative"}
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
            className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2"
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <span className="break-words font-mono text-lg font-bold sm:text-2xl">
              {turn.hint.hint} ({turn.hint.count})
            </span>
            {turn.guessesRemaining !== undefined && (
              <span className="text-xs text-purple-400 sm:text-sm">
                {turn.guessesRemaining} guess
                {turn.guessesRemaining !== 1 ? "es" : ""} left
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
  const deadline = +new Date(until);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );

  useEffect(() => {
    const update = () =>
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    // Catch up immediately after returning to a backgrounded tab.
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline]);

  return (
    <div className="flex shrink-0 items-center">
      <span
        role="timer"
        aria-label={`${secondsLeft} seconds remaining`}
        className={`select-none font-mono text-2xl tabular-nums ${secondsLeft <= 15 ? "text-amber-300" : "text-purple-300"}`}
      >
        {Math.floor(secondsLeft / 60)}:
        {(secondsLeft % 60).toString().padStart(2, "0")}
      </span>
    </div>
  );
}

function WordMatrix({
  canGuess,
  isGameOver,
  words,
  currentPlayer,
  turn,
  onRevealWord,
}: {
  canGuess: boolean;
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
      {words.map((wordCard) => (
        <Word
          canGuess={canGuess}
          isGameOver={isGameOver}
          key={wordCard.word}
          wordCard={wordCard}
          currentPlayer={currentPlayer}
          onRevealWord={onRevealWord}
        />
      ))}
    </div>
  );
}

function Word({
  canGuess,
  isGameOver,
  wordCard,
  currentPlayer,
  onRevealWord,
}: {
  canGuess: boolean;
  isGameOver: boolean;
  wordCard: WordCard;
  currentPlayer: Player;
  onRevealWord: (word: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const isInteractive = canGuess && !wordCard.revealed;
  const isSpymaster = currentPlayer.role === "spymaster";
  const showWord = !!wordCard.revealed || isSpymaster || isGameOver;

  let bgColor = "bg-[#f5f0ff] card-shadow-default";
  let textColor = "!text-[#1a1530]";

  if (showWord) {
    if (wordCard.isAssassin) {
      bgColor =
        "bg-gradient-to-br from-red-600 to-red-400 card-shadow-assassin";
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
    <motion.button
      type="button"
      disabled={!isInteractive}
      aria-label={`${wordCard.word}${wordCard.revealed ? ", revealed" : ""}${showWord ? (wordCard.isAssassin ? ", assassin" : wordCard.team !== undefined ? `, Team ${getTeamName(wordCard.team)}` : ", neutral") : ""}`}
      key={wordCard.word}
      className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-[14px] p-1 sm:p-2 md:min-h-24 md:p-4 lg:p-6 ${isInteractive ? "cursor-pointer" : "cursor-default"} focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent ${bgColor}`}
      onClick={() => {
        if (isInteractive) onRevealWord(wordCard.word);
      }}
      whileHover={
        isInteractive && !reduceMotion ? { scale: 1.025, y: -2 } : undefined
      }
      whileTap={isInteractive && !reduceMotion ? { scale: 0.98 } : undefined}
      initial={false}
      animate={{ opacity, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
    >
      <AnimatePresence initial={false}>
        {wordCard.revealed && (
          <motion.span
            aria-hidden="true"
            className={`absolute right-1 top-0.5 text-xs md:right-2 md:top-1 ${textColor}`}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            {wordCard.isAssassin ? "☠" : "✓"}
          </motion.span>
        )}
      </AnimatePresence>
      <span
        className={`text-xs font-extrabold leading-tight ${textColor} min-w-0 [overflow-wrap:anywhere] select-none text-center md:text-base lg:text-xl`}
      >
        {wordCard.word}
      </span>
    </motion.button>
  );
}
