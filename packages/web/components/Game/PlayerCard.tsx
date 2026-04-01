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
      className={`relative min-w-48 cursor-pointer select-none rounded-xl bg-surface p-2 px-3 drop-shadow-md ${player.id === currentPlayerId ? "glow" : ""}`}
    >
      {player.role === "spymaster" && (
        <motion.span
          className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-md bg-amber-400 px-2 py-0.5 text-xs font-bold text-black shadow-md"
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          Spymaster
        </motion.span>
      )}
      <span className="text-base font-bold !text-white md:text-lg">
        {player.name}
        {player.id === currentPlayerId && " (you!)"}
      </span>
    </div>
  );
}
