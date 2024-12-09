import { motion } from "motion/react";
import { Player } from "schema";

export default function PlayerCard({
  player,
  currentPlayerId,
}: {
  player: Player;
  currentPlayerId: string;
}) {
  return (
    <div
      key={player.id}
      className={`indicator min-w-48 cursor-pointer select-none rounded-lg p-1 px-2 text-gray-900 drop-shadow-md dark:bg-white ${player.id === currentPlayerId ? "glow" : ""}`}
    >
      {player.role === "spymaster" && (
        <motion.div
          className="badge indicator-item badge-accent badge-sm indicator-center p-1 font-bold text-white shadow-md"
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          Spymaster
        </motion.div>
      )}
      <span className="place-items-center text-base font-bold md:text-lg">
        {player.name}
        {player.id === currentPlayerId && " (you!)"}
      </span>
    </div>
  );
}
