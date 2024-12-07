import { useEffect, useState } from "react";
import { GameResult, Player, Turn, WordCard } from "schema";
import HintInput from "./HintInput";
import PlayerCard from "./PlayerCard";
import { useWarnBeforeReloading } from "./hooks/useWarnBeforeReloading";
import { HintHistoryItem } from "./hooks/useCodenames";
import { AnimatePresence, motion } from "motion/react";

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
  hintHistory: HintHistoryItem[];
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

  return (
    <div className="flex flex-col gap-4">
      <TeamInfo
        isGameOver={!!gameResult}
        players={players}
        currentPlayer={currentPlayer}
        turn={turn}
        remainingWordsByTeam={remainingWordsByTeam}
      />
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
      <div className="font-mono text-lg font-medium">{previousHints}</div>
    </div>
  );
}

function Result({ gameResult }: { gameResult?: GameResult }) {
  const { winningTeam, losingTeam } = gameResult || {};
  return (
    <span className="text-2xl font-bold">
      {winningTeam !== undefined && `Team ${winningTeam} wins!`}
      {losingTeam !== undefined && `Team ${losingTeam} loses...`}
    </span>
  );
}

function TeamInfo({
  isGameOver,
  players,
  turn,
  currentPlayer,
  remainingWordsByTeam,
}: {
  isGameOver: boolean;
  players: Player[];
  currentPlayer: Player;
  turn: Turn;
  remainingWordsByTeam: number[];
}) {
  // Group players by team
  const teams = players.reduce(
    (acc, player) => {
      if (!acc[player.team]) {
        acc[player.team] = [];
      }
      acc[player.team].push(player);
      return acc;
    },
    {} as Record<number, Player[]>,
  );

  return (
    <div className="flex justify-between">
      {Object.entries(teams).map(([teamId, teamPlayers], teamIndex) => (
        <div
          key={teamId}
          className={`relative bg-${getTeamColor(teamIndex)}-500 flex flex-col gap-2 rounded-lg p-2 px-2`}
        >
          {turn.team === teamIndex && !isGameOver && (
            <motion.div
              className="absolute -left-4 -top-6 m-2 opacity-95"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
            >
              <span className="text-m inline-flex items-center rounded-full bg-red-500 px-2.5 py-0.5 font-bold text-white drop-shadow-md">
                Now guessing!
              </span>
            </motion.div>
          )}

          <div className="flex items-center justify-between px-2">
            <h2 className={`text-lg font-black md:text-xl`}>Team {teamId}</h2>
            <motion.span
              key={remainingWordsByTeam[teamIndex]}
              className="text-2xl font-black"
              initial={{ scale: 0 }}
              animate={{ scale: 1.2 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {remainingWordsByTeam.at(teamIndex) ?? "?"}
            </motion.span>
          </div>
          <div className="flex flex-col gap-2">
            {teamPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                currentPlayerId={currentPlayer.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
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
      <div className="">
        {turn.hint ? (
          <p className="font-mono text-2xl font-bold">{turn.hint.hint}</p>
        ) : (
          isCurrentlySpymaster && <HintInput giveHint={giveHint} />
        )}
      </div>
    </div>
  );
}

function Timer({ until }: { until: Date }) {
  const [timeLeft, setTimeLeft] = useState({ minutes: "", seconds: "" });

  useEffect(() => {
    const timer = setInterval(() => {
      const difference = +new Date(until) - +new Date();
      let timeLeft = {
        minutes: "0",
        seconds: "00",
      };
      if (difference > 0) {
        timeLeft = {
          minutes: Math.floor((difference / (1000 * 60)) % 60).toString(),
          seconds: Math.floor((difference / 1000) % 60)
            .toString()
            .padStart(2, "0"),
        };
      }
      setTimeLeft(timeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [until]);

  const remainingTime =
    !!timeLeft.minutes && !!timeLeft.seconds
      ? `${timeLeft.minutes}:${timeLeft.seconds}`
      : "0:00";

  return (
    <div className="flex font-mono text-2xl">
      <AnimatePresence>
        <motion.span
          className="absolute"
          key={remainingTime}
          exit={{ y: 0, opacity: 0 }}
          initial={{ y: 0, opacity: 0.0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            duration: 0.3,
          }}
        >
          {remainingTime}
        </motion.span>
        <span className="">{remainingTime}</span>
      </AnimatePresence>
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
  const borderColor = `border-${teamColor}-500/40`;

  return (
    <div
      className={`grid grid-cols-5 grid-rows-5 gap-2 rounded-xl border-8 border-solid ${borderColor} p-2`}
    >
      {words.map((wordCard) => (
        <Word
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
  isGameOver,
  wordCard,
  currentPlayer,
  onRevealWord,
}: {
  isGameOver: boolean;
  wordCard: WordCard;
  currentPlayer: Player;
  onRevealWord: (word: string) => void;
}) {
  const isSpymaster = currentPlayer.role === "spymaster";
  const showWord = !!wordCard.revealed || isSpymaster || isGameOver;

  // Determine colors
  let bgColor = "bg-white";
  if (showWord) {
    if (wordCard.team === undefined && !wordCard.isAssassin) {
      bgColor = "bg-gray-400";
    } else if (wordCard.isAssassin) {
      bgColor = "bg-red-500"; // black?
    } else if (wordCard.team !== undefined) {
      const color = getTeamColor(wordCard.team);
      bgColor = `bg-${color}-500`;
    }
  }

  const textColor = showWord ? "text-white" : "text-black";
  const opacity =
    !wordCard.revealed && (isSpymaster || isGameOver) ? 0.5 : 0.95;

  return (
    <motion.div
      key={wordCard.word}
      className={`justify-top flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg p-4 lg:p-8 ${bgColor}`}
      onClick={() => onRevealWord(wordCard.word)}
      whileHover={{ scale: 1.08, opacity: 0.9 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 10,
        duration: 0.5,
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

const getTeamColor = (team: number) => {
  switch (team) {
    case 0:
      return "purple";
    case 1:
      return "green";
    case 2:
      return "pink";
    default:
      return "blue";
  }
};
