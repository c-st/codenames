import { AnimatePresence, motion } from "motion/react";
import { Player, Turn } from "schema";
import { getTeamColor, getTeamName } from "./getTeamColor";

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
      (acc[player.team] ??= []).push(player);
      return acc;
    },
    {} as Record<number, Player[]>,
  );

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      {Object.entries(teams).map(([teamId, teamPlayers]) => {
        const team = Number(teamId);
        const color = getTeamColor(team);
        const isActive = turn.team === team;
        const remaining = remainingWordsByTeam[team] ?? 0;
        return (
          <section
            key={teamId}
            aria-label={`Team ${getTeamName(team)}`}
            className={`flex items-center gap-3 rounded-xl bg-surface/50 p-3 ${!isGameOver && !isActive ? "opacity-60" : ""}`}
          >
            <div className="flex min-w-16 flex-col items-center gap-1">
              <span className="text-xs font-semibold text-purple-200">
                {getTeamName(team)}
              </span>
              <motion.span
                key={remaining}
                aria-label={`${remaining} words remaining`}
                className={`flex h-10 w-10 select-none items-center justify-center rounded-xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} text-xl font-black !text-white`}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.18 }}
              >
                {remaining}
              </motion.span>
              <AnimatePresence>
                {isActive && !isGameOver && (
                  <motion.span
                    className="text-[0.6rem] font-bold text-amber-400"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {turn.hint ? "GUESSING" : "GIVING CLUE"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...teamPlayers]
                .sort(
                  (a, b) =>
                    Number(b.role === "spymaster") -
                    Number(a.role === "spymaster"),
                )
                .map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-1.5 rounded-full bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-3 py-1 text-sm font-semibold !text-white ${player.id === currentPlayer.id ? "ring-1 ring-accent/60" : ""}`}
                  >
                    <span aria-hidden="true">{player.animal || "🐾"}</span>
                    <span className="max-w-24 truncate">{player.name}</span>
                    {player.role === "spymaster" && (
                      <span aria-label="Spymaster" title="Spymaster">
                        🕵️
                      </span>
                    )}
                    {player.id === currentPlayer.id && (
                      <span className="text-[0.6rem] text-white/60">you</span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
