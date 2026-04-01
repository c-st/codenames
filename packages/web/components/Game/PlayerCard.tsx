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
      className={`indicator min-w-48 cursor-pointer select-none rounded-xl bg-surface p-1 px-2 text-white drop-shadow-md ${player.id === currentPlayerId ? "glow" : ""}`}
    >
      {player.role === "spymaster" && (
        <motion.div
          className="badge indicator-item badge-sm indicator-center rounded-md bg-amber-400 p-1 font-bold text-black shadow-md"
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
