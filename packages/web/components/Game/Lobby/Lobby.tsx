import { motion } from "motion/react";
import { Player } from "schema";
import NameInput from "./NameInput";
import TeamTable from "./TeamTable";

export default function Lobby({
  players,
  currentPlayerId,
  promoteToSpymaster,
  setName,
  onBackToHome,
}: {
  players: Player[];
  currentPlayerId: string;
  promoteToSpymaster: (playerId: string) => void;
  setName: (name: string) => void;
  gameCanBeStarted: boolean;
  startGame: () => void;
  onBackToHome?: () => void;
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

  const roleEmoji = currentPlayer.role === "spymaster" ? "🕵️" : "🔍";
  const roleName = currentPlayer.role === "spymaster" ? "Spymaster" : "Operative";

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Role card */}
      <motion.div
        className="flex flex-col items-center gap-4 rounded-2xl border border-purple-700/30 bg-surface px-8 py-6 shadow-lg"
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.span
          className="text-4xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.1 }}
        >
          {roleEmoji}
        </motion.span>
        <div className="text-center">
          <p className="text-sm font-semibold text-purple-400">Your role</p>
          <p className="text-2xl font-black !text-white">{roleName}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold text-purple-400">Your name</p>
          <NameInput name={currentPlayer.name} setName={setName} />
        </div>
      </motion.div>

      {/* Section header */}
      <motion.div
        className="flex w-full items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="h-px flex-1 bg-purple-700/30"></div>
        <span className="text-sm font-bold text-purple-400">TEAMS</span>
        <div className="h-px flex-1 bg-purple-700/30"></div>
      </motion.div>

      {/* Teams */}
      <div className="flex flex-wrap justify-center gap-6">
        {Object.keys(teams).map((team, i) => (
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
        ))}
      </div>

      {/* Back to home */}
      {onBackToHome && (
        <motion.button
          className="text-sm font-semibold text-purple-500 transition-colors hover:text-purple-300"
          onClick={onBackToHome}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.95 }}
        >
          ← Back to home
        </motion.button>
      )}
    </motion.div>
  );
}
