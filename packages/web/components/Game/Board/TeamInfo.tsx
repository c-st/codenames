import { AnimatePresence, motion } from "motion/react";
import { Player, Turn } from "schema";
import AnimalAvatar from "@/components/ui/AnimalAvatar";
import { getTeamColor, getTeamName } from "./getTeamColor";

/** One glowing scoreboard per team; the team whose turn it is breathes in its colour. */
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
        const isActive = turn.team === team && !isGameOver;
        const remaining = remainingWordsByTeam[team] ?? 0;
        return (
          <motion.section
            key={teamId}
            aria-label={`Team ${getTeamName(team)}`}
            className={`glass-panel glass-wash flex items-center gap-4 !rounded-2xl p-3 transition-opacity duration-500 ${!isGameOver && !isActive ? "opacity-55" : ""}`}
            style={{ ["--wash" as string]: color.hex }}
            animate={
              isActive
                ? {
                    boxShadow: [
                      `0 0 0px ${color.hex}00`,
                      `0 0 26px ${color.hex}aa`,
                      `0 0 0px ${color.hex}00`,
                    ],
                  }
                : { boxShadow: `0 0 0px ${color.hex}00` }
            }
            transition={
              isActive
                ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.3 }
            }
          >
            <div className="relative flex min-w-16 flex-col items-center gap-0.5">
              <span
                className="text-xs font-black uppercase tracking-[0.14em]"
                style={{ color: color.hex, textShadow: `0 0 10px ${color.hex}` }}
              >
                {getTeamName(team)}
              </span>
              <motion.span
                key={remaining}
                aria-label={`${remaining} words remaining`}
                className="select-none text-4xl font-black tabular-nums !text-white"
                style={{ textShadow: `0 0 18px ${color.hex}` }}
                initial={{ scale: 1.7, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 14 }}
              >
                {remaining}
              </motion.span>
              <AnimatePresence mode="wait">
                {isActive && (
                  <motion.span
                    key={turn.hint ? "guessing" : "clue"}
                    className="text-[0.6rem] font-bold tracking-wider text-amber-300"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    {turn.hint ? "GUESSING" : "GIVING CLUE"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="relative flex min-w-0 flex-wrap gap-x-3 gap-y-2">
              {[...teamPlayers]
                .sort(
                  (a, b) =>
                    Number(b.role === "spymaster") -
                    Number(a.role === "spymaster"),
                )
                .map((player) => {
                  const isYou = player.id === currentPlayer.id;
                  return (
                    <div
                      key={player.id}
                      className="flex min-w-0 items-center gap-1.5 pt-1.5"
                    >
                      <AnimalAvatar
                        animal={player.animal}
                        size="sm"
                        crowned={player.role === "spymaster"}
                        isYou={isYou}
                        glowColor={color.hex}
                      />
                      <span className="max-w-24 truncate text-sm font-bold !text-white">
                        {player.name}
                      </span>
                      {player.role === "spymaster" && (
                        <span className="sr-only">Spymaster</span>
                      )}
                      {isYou && (
                        <span className="text-[0.6rem] font-bold text-purple-200/70">
                          you
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
