import { AnimatePresence, motion } from "motion/react";
import { Player, Turn } from "schema";
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

  const teamEntries = Object.entries(teams);

  return (
    <div className="flex w-full items-center justify-between gap-2">
      {teamEntries.map(([teamId, teamPlayers], teamIndex) => {
        const color = getTeamColor(teamIndex);
        const isActive = turn.team === teamIndex;
        const remaining = remainingWordsByTeam.at(teamIndex) ?? 0;
        const isFirst = teamIndex === 0;
        const isLast = teamIndex === teamEntries.length - 1;

        const scoreBlock = (
          <motion.div
            className={`flex flex-col items-center gap-1 ${!isGameOver && !isActive ? "opacity-50" : ""}`}
            animate={{ scale: isActive && !isGameOver ? 1.1 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.span
              key={remaining}
              className={`flex h-10 w-10 cursor-default select-none items-center justify-center rounded-xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} text-xl font-black !text-white`}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              {remaining}
            </motion.span>
            <AnimatePresence>
              {isActive && !isGameOver && (
                <motion.span
                  className="select-none text-[0.6rem] font-bold text-amber-400"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  GUESSING
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        );

        const pillsBlock = (
          <div className={`flex flex-wrap gap-1.5 ${isLast ? "justify-end" : "justify-start"}`}>
            {teamPlayers
              .sort((a) => (a.role === "spymaster" ? -1 : 1))
              .map((player) => {
                const isYou = player.id === currentPlayer.id;
                const isSpy = player.role === "spymaster";
                return (
                  <motion.div
                    key={player.id}
                    className={`flex items-center gap-1.5 rounded-full bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-3 py-1 text-sm font-semibold !text-white ${isYou ? "ring-1 ring-accent/60" : ""} ${!isGameOver && !isActive ? "opacity-60" : ""}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: !isGameOver && !isActive ? 0.6 : 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${isSpy ? "bg-amber-400" : "bg-white/40"}`}
                    />
                    <span className="max-w-24 truncate">{player.name}</span>
                    {isYou && (
                      <span className="text-[0.6rem] text-white/60">you</span>
                    )}
                  </motion.div>
                );
              })}
          </div>
        );

        return (
          <div key={teamId} className="contents">
            {/* First team: score on left, pills on right */}
            {isFirst && scoreBlock}
            {isFirst && pillsBlock}

            {/* Divider */}
            {!isLast && <div className="h-6 w-px flex-shrink-0 bg-purple-700/40" />}

            {/* Last team: pills on left, score on right */}
            {isLast && pillsBlock}
            {isLast && scoreBlock}
          </div>
        );
      })}
    </div>
  );
}
