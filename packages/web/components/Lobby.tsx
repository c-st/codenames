import { AnimatePresence, Reorder } from "framer-motion";
import { useEffect, useState } from "react";
import { Player } from "schema";
import { Button } from "./ui/Button";

export default function Lobby({
  players,
  currentPlayerId,
  promoteToSpymaster,
  setName,
  gameCanBeStarted,
  startGame,
}: {
  players: Player[];
  currentPlayerId: string;
  promoteToSpymaster: (playerId: string) => void;
  setName: (name: string) => void;
  gameCanBeStarted: boolean;
  startGame: () => void;
}) {
  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  if (!currentPlayer) {
    return null;
  }

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
    <div className="flex flex-col items-center gap-12">
      <h1 className="text-2xl font-black md:text-4xl">Lobby</h1>
      <div className="flex items-center gap-4">
        <p className="text-xl font-black">That&apos;s you: </p>
        <NameField player={currentPlayer} onSetName={setName} />
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        {Object.keys(teams).map((team) => {
          return (
            <TeamTable
              key={team}
              team={teams[parseInt(team)]}
              currentPlayerId={currentPlayerId}
              onNewSpymaster={promoteToSpymaster}
            />
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-4">
        {gameCanBeStarted ? (
          <Button title="Start game" onClick={startGame} />
        ) : (
          <span className="text-xl font-bold">Waiting for more players...</span>
        )}
      </div>
    </div>
  );
}

function NameField({
  player,
  onSetName,
}: {
  player: Player;
  onSetName: (name: string) => void;
}) {
  return (
    <input
      type="text"
      className="text-md font-base h-12 w-48 rounded-2xl border-2 border-gray-300 px-4 py-2 font-mono focus:border-transparent focus:outline-none focus:ring-4 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:ring-blue-500"
      placeholder="Enter your name"
      value={player.name}
      onChange={(e) => onSetName(e.target.value)}
    />
  );
}

function TeamTable({
  team,
  // onNewSpymaster,
  currentPlayerId,
}: {
  team: Player[];
  currentPlayerId: string;
  onNewSpymaster: (playerId: string) => void;
}) {
  const [sortedTeam, setSortedTeam] = useState<Player[]>([]);

  useEffect(() => {
    if (team.length === 0) return;
    setSortedTeam([...team].sort((a) => (a.role === "spymaster" ? -1 : 1)));
  }, [team]);

  useEffect(() => {
    if (sortedTeam.length === 0) {
      return;
    }
    const newSpymaster = sortedTeam.at(0);
    if (newSpymaster && newSpymaster.role !== "spymaster") {
      console.log("Promoting new spymaster", sortedTeam.at(0));
      // onNewSpymaster(newSpymaster.id);
    }
  }, [sortedTeam]);

  return (
    <div className="flex min-w-32 flex-col gap-2 rounded-lg p-4 shadow-md dark:bg-gray-800">
      <AnimatePresence>
        <Reorder.Group
          axis="y"
          values={team}
          onReorder={setSortedTeam}
          className="flex flex-col items-center gap-4"
        >
          {sortedTeam.map((player) => {
            return (
              <Reorder.Item
                key={player.id}
                value={player}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <PlayerCard player={player} currentPlayerId={currentPlayerId} />
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      </AnimatePresence>
    </div>
  );
}

function PlayerCard({
  player,
  currentPlayerId,
}: {
  player: Player;
  currentPlayerId: string;
}) {
  return (
    <div
      key={player.id}
      className={`flex w-56 min-w-24 flex-col justify-center gap-2 rounded-lg bg-gray-200 p-2 px-4 text-gray-900 shadow-md dark:bg-white`}
    >
      <span className="text-base font-bold md:text-xl">
        {player.name}
        {player.id === currentPlayerId && " (you)"}
        {player.role === "spymaster" && " *"}
      </span>
    </div>
  );
}
