import { useEffect, useState } from "react";
import { GameResult, Player, Turn, WordCard } from "schema";
import { Button } from "./ui/Button";
import { motion } from "framer-motion";

export default function Board({
  players,
  currentPlayerId,
  words,
  turn,
  gameResult,
  gameCanBeStarted,
  startGame,
  // giveHint,
  revealWord,
  endTurn,
  endGame,
}: {
  players: Player[];
  currentPlayerId: string;
  words?: WordCard[];
  turn: Turn;
  gameResult?: GameResult;
  gameCanBeStarted: boolean;
  startGame: () => void;
  giveHint: (hint: string, count: number) => void;
  revealWord: (word: string) => void;
  endTurn: () => void;
  endGame: () => void;
}) {
  const { until } = turn;

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
      <TeamInfo players={players} currentPlayer={currentPlayer} turn={turn} />
      <div className="flex justify-between">
        <Hint turn={turn} />
        {gameResult && <Result gameResult={gameResult} />}
        {gameResult === undefined && <Timer until={until} />}
      </div>
      <WordMatrix
        words={words}
        turn={turn}
        currentPlayer={currentPlayer}
        onRevealWord={revealWord}
      />
      <GameActions
        isCurrentTurn={isCurrentTurn}
        gameResult={gameResult}
        gameCanBeStarted={gameCanBeStarted}
        startGame={startGame}
        endTurn={endTurn}
        endGame={endGame}
      />
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
  players,
  turn,
  currentPlayer,
}: {
  players: Player[];
  currentPlayer: Player;
  turn: Turn;
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

  // show each team's players
  return (
    <div className="flex justify-between">
      {Object.entries(teams).map(([teamId, teamPlayers], index) => (
        <div
          key={teamId}
          className={`bg-${getTeamColor(index)}-500 flex flex-col rounded-lg p-2 ${turn.team === index ? "opacity-100" : "opacity-50"}`}
        >
          <h2 className={`mb-1 font-black md:text-xl`}>Team {teamId}</h2>

          {teamPlayers.map((player) => (
            <div
              key={player.id}
              className={`text-md ${player.id === currentPlayer.id ? "font-black" : "font-bold"}`}
            >
              {player.name}
              {player.role === "spymaster" && " (spymaster)"}
              {player.id === currentPlayer.id && " (you)"}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Hint({ turn }: { turn: Turn }) {
  return (
    <div>
      <div className="font-mono text-2xl font-bold">
        {turn.hint ? (
          <p className="font-mono text-2xl">
            {turn.hint.hint} {turn.hint.count}
          </p>
        ) : (
          ""
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

  return (
    <div className="flex justify-end">
      <span className="font-mono text-2xl">
        {timeLeft.minutes}:{timeLeft.seconds}
      </span>
    </div>
  );
}

function WordMatrix({
  words,
  currentPlayer,
  turn,
  onRevealWord,
}: {
  words: WordCard[];
  currentPlayer: Player;
  turn: Turn;
  onRevealWord: (word: string) => void;
}) {
  const teamColor = getTeamColor(turn.team);
  const borderColor = `border-${teamColor}-500/20`;

  return (
    <div
      className={`grid grid-cols-5 grid-rows-5 gap-2 rounded-xl border-8 border-solid ${borderColor} p-2`}
    >
      {words.map((wordCard) => (
        <Word
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
  wordCard,
  currentPlayer,
  onRevealWord,
}: {
  wordCard: WordCard;
  currentPlayer: Player;
  onRevealWord: (word: string) => void;
}) {
  const isSpymaster = currentPlayer.role === "spymaster";
  const showWord = wordCard.isRevealed || isSpymaster;

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
  const opacity = !wordCard.isRevealed && isSpymaster ? 0.5 : 0.95;

  return (
    <motion.div
      key={wordCard.word}
      className={`justify-top flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg p-4 lg:p-8 ${bgColor}`}
      onClick={() => onRevealWord(wordCard.word)}
      whileHover={{ scale: 1.05, opacity: 0.8 }}
      whileTap={{ scale: 0.95 }}
      animate={{ opacity }}
      initial={{ opacity: isSpymaster ? 1 : 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        duration: 0.5,
      }}
    >
      <p className={`text-m font-extrabold ${textColor} md:text-xl`}>
        {wordCard.word}
      </p>
    </motion.div>
  );
}

function GameActions({
  isCurrentTurn,
  gameResult,
  gameCanBeStarted,
  startGame,
  endTurn,
  endGame,
}: {
  isCurrentTurn: boolean;
  gameResult?: GameResult;
  gameCanBeStarted: boolean;
  startGame: () => void;
  endTurn: () => void;
  endGame: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-2">
      {gameResult && gameCanBeStarted && (
        <Button title="Start new game" onClick={startGame} />
      )}
      {!gameResult && gameCanBeStarted && isCurrentTurn && (
        <Button title="End turn" onClick={endTurn} />
      )}
      {!gameCanBeStarted && (
        <>
          <span className="text-xl font-bold">Waiting for more players...</span>
          <Button title="Return to lobby" onClick={endGame} />
        </>
      )}
    </div>
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
