import { AnimatePresence, motion } from "motion/react";
import { Player } from "schema";
import { getTeamColor } from "../Board/getTeamColor";

export default function TeamTable({
  players,
  teamId,
  onNewSpymaster,
  currentPlayerId,
}: {
  players: Player[];
  teamId: number;
  currentPlayerId: string;
  onNewSpymaster: (playerId: string) => void;
}) {
  const color = getTeamColor(teamId);
  const sorted = [...players].sort((a) => (a.role === "spymaster" ? -1 : 1));

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`flex min-w-32 flex-col gap-3 rounded-2xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} select-none p-4 shadow-md`}
      >
        <h2 className="text-lg font-bold md:text-xl">
          Team {teamId}
        </h2>
        <div className="flex flex-col items-center gap-3">
          <AnimatePresence>
            {sorted.map((player) => {
              const isSpymaster = player.role === "spymaster";
              const isYou = player.id === currentPlayerId;
              return (
                <motion.div
                  key={player.id}
                  className={`flex min-w-48 cursor-pointer items-center justify-between rounded-xl bg-surface p-2 px-3 !text-white drop-shadow-md ${isYou ? "glow" : ""}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => !isSpymaster && onNewSpymaster(player.id)}
                >
                  <div className="flex flex-col">
                    <span className="text-base font-bold !text-white md:text-lg">
                      {player.name}
                      {isYou && " (you!)"}
                    </span>
                    <span
                      className={`text-xs font-semibold ${isSpymaster ? "text-amber-400" : "text-purple-400"}`}
                    >
                      {isSpymaster ? "Spymaster" : "Operative"}
                    </span>
                  </div>
                  {!isSpymaster && (
                    <span className="text-xs text-purple-400/60">
                      tap to promote
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
