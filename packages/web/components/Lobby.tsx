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

  const teams = players.reduce((acc, player) => {
    if (!acc[player.team]) {
      acc[player.team] = [];
    }
    acc[player.team].push(player);
    return acc;
  }, {} as Record<number, Player[]>);

  return (
    <div className="flex flex-col items-center gap-12">
      <h1 className="md:text-4xl text-2xl font-black">Lobby</h1>
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
      <div className="flex flex-col gap-4 items-center">
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
      className="px-4 py-2 h-12 w-48 text-md font-base font-mono border-2 border-gray-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500"
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
    <div className="dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col gap-2 min-w-32">
      <AnimatePresence>
        <Reorder.Group
          axis="y"
          values={team}
          onReorder={setSortedTeam}
          className="flex flex-col gap-4 items-center"
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
      className={`dark:bg-white bg-gray-200 text-gray-900 rounded-lg shadow-md min-w-24 w-56 px-4 p-2 flex flex-col gap-2 justify-center
        `}
    >
      <span className="md:text-xl text-base font-bold">
        {player.name}
        {player.id === currentPlayerId && " (you)"}
        {player.role === "spymaster" && " *"}
      </span>
    </div>
  );
}
