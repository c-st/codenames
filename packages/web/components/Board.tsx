import { useEffect, useState } from "react";
import { GameResult, Player, Turn, WordCard } from "schema";
import { Button } from "./ui/Button";

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
}) {
  const { until } = turn;

  if (words === undefined) {
    return null;
  }
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <TeamInfo players={players} currentPlayer={currentPlayer} turn={turn} />
      <div className="flex justify-between">
        <Hint turn={turn} />-{JSON.stringify(gameResult, null, 2)}-
        {gameResult === undefined && <Timer until={until} />}
      </div>
      <WordMatrix
        words={words}
        currentPlayer={currentPlayer}
        onRevealWord={revealWord}
      />
      <GameActions
        gameResult={gameResult}
        gameCanBeStarted={gameCanBeStarted}
        startGame={startGame}
      />
    </div>
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
        <div key={teamId} className="flex flex-col">
          <h2
            className={`mb-1 text-lg font-black md:text-2xl text-${getTeamColor(index)}-500 text-center`}
          >
            Team {teamId}
            {teamId === turn.team.toString() && " (active)"}
          </h2>

          {teamPlayers.map((player) => (
            <div
              key={player.id}
              className={`${player.id === currentPlayer.id ? "font-bold" : "font-normal"}`}
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
  onRevealWord,
}: {
  words: WordCard[];
  currentPlayer: Player;
  onRevealWord: (word: string) => void;
}) {
  return (
    <div className="grid grid-cols-5 grid-rows-5 gap-2">
      {words.map((wordCard) => (
        <Word
          key={wordCard.word}
          word={wordCard}
          currentPlayer={currentPlayer}
          onRevealWord={onRevealWord}
        />
      ))}
    </div>
  );
}

function Word({
  word,
  currentPlayer,
  onRevealWord,
}: {
  word: WordCard;
  currentPlayer: Player;
  onRevealWord: (word: string) => void;
}) {
  const isSpymaster = currentPlayer.role === "spymaster";
  const showWord = word.isRevealed || isSpymaster;

  // Determine colors
  let bgColor = "bg-white";
  if (showWord) {
    if (word.team === undefined && !word.isAssassin) {
      bgColor = "bg-gray-400";
    } else if (word.isAssassin) {
      bgColor = "bg-red-500"; // black?
    } else if (word.team !== undefined) {
      bgColor = `bg-${getTeamColor(word.team)}-500`;
    }
  }

  const textColor = showWord ? "text-white" : "text-black";
  const opacity = !word.isRevealed && isSpymaster ? "opacity-30" : "";

  // if revealed, show in team color of team
  return (
    <div
      className={`justify-top flex h-20 cursor-pointer flex-col justify-center gap-1 rounded-lg p-4 lg:p-8 ${bgColor} ${opacity}`}
      onClick={() => onRevealWord(word.word)}
    >
      <p
        className={`text-m text-center font-extrabold ${textColor} md:text-xl`}
      >
        {word.word}
      </p>
      {/* {word.isRevealed && "✔️"} */}
      {/* {showWord && word.team} */}
      {/* {showWord && word.isAssassin && "💣"} */}
    </div>
  );
}

function GameActions({
  gameResult,
  gameCanBeStarted,
  startGame,
}: {
  gameResult?: GameResult;
  gameCanBeStarted: boolean;
  startGame: () => void;
}) {
  return (
    <div className="mt-8 flex justify-center">
      {gameResult && gameCanBeStarted && (
        <Button title="Start new game" onClick={startGame} />
      )}
      {!gameCanBeStarted && (
        <span className="text-xl font-bold">Waiting for more players...</span>
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
      return "orange";
    case 3:
      return "pink";
    default:
      return "blue";
  }
};
