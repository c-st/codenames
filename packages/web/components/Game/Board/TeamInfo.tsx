import { AnimatePresence, motion } from "motion/react";
import { Player, Turn } from "schema";
import PlayerCard from "../PlayerCard";
import { getTeamColor } from "./getTeamColor";

export default function TeamInfo({
  isGameOver,
  players,
  turn,
  currentPlayer,
  remainingWordsByTeam,
}: {
  isGameOver: boolean;
  players: Player[];
  currentPlayer: Player;
  turn: Turn;
  remainingWordsByTeam: number[];
}) {
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
    <div className="flex justify-between gap-4">
      <AnimatePresence>
        {Object.entries(teams).map(([teamId, teamPlayers], teamIndex) => {
          const color = getTeamColor(teamIndex);
          const isActive = turn.team === teamIndex;
          return (
            <motion.div
              key={teamId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isGameOver ? 1 : isActive ? 1 : 0.5, y: 0, scale: isGameOver ? 1 : isActive ? 1 : 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`indicator relative flex flex-1 flex-col gap-2 rounded-2xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} p-3 px-4 ${!isGameOver && isActive ? "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-base" : ""}`}
            >
              {turn.team === teamIndex && !isGameOver && (
                <motion.div
                  className="badge indicator-item indicator-start rounded-lg bg-amber-400 p-3 px-3 text-black drop-shadow-md"
                  initial={{ opacity: 1, x: -50, y: -15 }}
                  animate={{ opacity: 1, x: -10, y: -15 }}
                  exit={{ opacity: 0, x: 200, y: -15 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                >
                  <span className="select-none font-bold">
                    Guessing!
                  </span>
                </motion.div>
              )}

              <div className="flex items-center justify-between px-1">
                <h2 className="select-none text-lg font-black md:text-xl">
                  Team {teamId}
                </h2>
                <motion.span
                  key={remainingWordsByTeam[teamIndex]}
                  className="select-none text-2xl font-black"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1.2 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {remainingWordsByTeam.at(teamIndex) ?? "?"}
                </motion.span>
              </div>
              <div className="flex flex-col gap-2">
                {teamPlayers
                  .sort((a) => (a.role === "spymaster" ? -1 : 1))
                  .map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      currentPlayerId={currentPlayer.id}
                    />
                  ))}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
