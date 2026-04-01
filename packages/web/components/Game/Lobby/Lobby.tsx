import { motion } from "motion/react";
import { Player } from "schema";
import NameInput from "./NameInput";
import TeamTable from "./TeamTable";

export default function Lobby({
  players,
  currentPlayerId,
  promoteToSpymaster,
  setName,
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
    <motion.div
      className="flex flex-col items-center gap-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.h1
        className="text-2xl font-black md:text-4xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        Lobby
      </motion.h1>
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
      >
        <label className="flex w-full max-w-xs flex-col gap-1">
          <p className="text-xl font-bold text-purple-200">Your name</p>
          <NameInput name={currentPlayer.name} setName={setName} />
        </label>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
      >
        <p className="text-xl font-semibold text-purple-200 md:text-2xl">
          Your role:{" "}
          {currentPlayer.role === "spymaster" ? "Spymaster" : "Operative"}.
        </p>
      </motion.div>
      <div className="h-px w-full bg-purple-800/50"></div>
      <div className="flex flex-wrap justify-center gap-8">
        {Object.keys(teams).map((team, i) => {
          return (
            <motion.div
              key={team}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 + i * 0.1 }}
            >
              <TeamTable
                teamId={parseInt(team)}
                players={teams[parseInt(team)]}
                currentPlayerId={currentPlayerId}
                onNewSpymaster={promoteToSpymaster}
              />
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
