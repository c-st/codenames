import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Player } from "schema";
import NameInput from "./NameInput";
import { getTeamColor, getTeamName } from "../Board/getTeamColor";
import { getSpymasterTitle } from "../spymasterTitle";

type WordPackId = "classic" | "movies" | "food" | "geography" | "science" | "tech" | "agile" | "design" | "startup" | "internet";

const WORD_PACKS: { id: WordPackId; label: string; emoji: string }[] = [
  { id: "classic", label: "Classic", emoji: "📝" },
  { id: "movies", label: "Movies", emoji: "🎬" },
  { id: "food", label: "Food", emoji: "🍕" },
  { id: "geography", label: "Geography", emoji: "🌍" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "agile", label: "Agile", emoji: "📋" },
  { id: "design", label: "Design", emoji: "🎨" },
  { id: "startup", label: "Startup", emoji: "🚀" },
  { id: "internet", label: "Internet", emoji: "🌐" },
];

const TEAM_COUNTS = [2, 3, 4];

export default function Lobby({
  players,
  currentPlayerId,
  promoteToSpymaster,
  setName,
  randomizeName,
  startGame,
  gameCanBeStarted,
  wordPack,
  teamCount,
  setWordPack,
  setTeamCount,
  onBackToHome,
}: {
  players: Player[];
  currentPlayerId: string;
  promoteToSpymaster: (playerId: string) => void;
  setName: (name: string) => void;
  randomizeName: () => void;
  gameCanBeStarted: boolean;
  startGame: () => void;
  wordPack: WordPackId;
  teamCount: number;
  setWordPack: (pack: WordPackId) => void;
  setTeamCount: (count: number) => void;
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
  const roleName = currentPlayer.role === "spymaster" ? getSpymasterTitle() : "Operative";

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
          className="cursor-default select-none text-4xl"
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
          <NameInput name={currentPlayer.name} setName={setName} onRandomize={randomizeName} />
        </div>
      </motion.div>

      {/* Section: Teams */}
      <SectionHeader label="TEAMS" delay={0.15} />

      <LayoutGroup>
        <div className="flex w-full justify-center gap-6">
          {Object.entries(teams).map(([teamId, teamPlayers], i) => {
            const color = getTeamColor(parseInt(teamId));
            return (
              <motion.div
                key={teamId}
                layout
                className="flex flex-1 flex-col items-center gap-3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 + i * 0.1 }}
              >
                <span className={`rounded-xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-4 py-1 text-sm font-bold !text-white`}>
                  Team {getTeamName(parseInt(teamId))}
                </span>
                <div className="flex w-full flex-col items-center gap-2">
                  <AnimatePresence mode="popLayout">
                    {teamPlayers
                      .sort((a) => (a.role === "spymaster" ? -1 : 1))
                      .map((player) => {
                        const isSpy = player.role === "spymaster";
                        const isYou = player.id === currentPlayerId;
                        return (
                          <motion.button
                            key={player.id}
                            layout
                            className={`flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold !text-white transition-colors ${
                              isSpy
                                ? `bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} shadow-md`
                                : "bg-elevated hover:bg-purple-800/50"
                            } ${isYou ? "ring-1 ring-accent/60" : ""}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={!isSpy ? { scale: 1.03 } : {}}
                            whileTap={!isSpy ? { scale: 0.97 } : {}}
                            onClick={() => !isSpy && promoteToSpymaster(player.id)}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          >
                            <motion.span
                              layout
                              className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${isSpy ? "bg-amber-400" : "bg-white/30"}`}
                              animate={{ scale: isSpy ? [1, 1.5, 1] : 1 }}
                              transition={{ duration: 0.3 }}
                            />
                            <span className="flex-1 truncate text-left">
                              {player.name}
                              {isYou && " (you)"}
                            </span>
                            {isSpy && (
                              <motion.span
                                className="flex-shrink-0 text-[0.65rem] text-amber-300"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                              >
                                {getSpymasterTitle()}
                              </motion.span>
                            )}
                            {!isSpy && (
                              <span className="flex-shrink-0 text-[0.65rem] text-purple-400/50">promote</span>
                            )}
                          </motion.button>
                        );
                      })}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Section: Game Settings */}
      <SectionHeader label="GAME SETTINGS" delay={0.3} />

      <motion.div
        className="flex w-full flex-col gap-5"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.35 }}
      >
        {/* Word Pack */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-purple-400/70">Word Pack</span>
          <div className="flex flex-wrap gap-2">
            {WORD_PACKS.map((pack) => (
              <motion.button
                key={pack.id}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  wordPack === pack.id
                    ? "bg-gradient-to-br from-primary to-accent !text-white shadow-md"
                    : "bg-elevated !text-white hover:bg-purple-800/50"
                }`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setWordPack(pack.id)}
              >
                {pack.emoji} {pack.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Team Count */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-purple-400/70">Number of Teams</span>
          <div className="flex gap-2">
            {TEAM_COUNTS.map((count) => {
              const needsPlayers = count * 2;
              const hasEnough = players.length >= needsPlayers;
              return (
                <motion.button
                  key={count}
                  className={`rounded-xl px-5 py-2 text-sm font-bold transition-colors ${
                    teamCount === count
                      ? "bg-gradient-to-br from-primary to-accent !text-white shadow-md"
                      : hasEnough
                        ? "bg-elevated !text-white hover:bg-purple-800/50"
                        : "cursor-not-allowed bg-elevated/50 !text-purple-300/40"
                  }`}
                  whileHover={hasEnough ? { scale: 1.03 } : {}}
                  whileTap={hasEnough ? { scale: 0.97 } : {}}
                  onClick={() => hasEnough && setTeamCount(count)}
                >
                  {count} teams
                  {!hasEnough && (
                    <span className="ml-1 text-[0.6rem] !text-purple-300/40">
                      ({needsPlayers}+)
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Start button */}
      {gameCanBeStarted && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            className="rounded-2xl bg-gradient-to-br from-primary to-accent px-10 py-4 text-xl font-bold !text-white shadow-lg shadow-primary/40"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => startGame()}
          >
            Start Game
          </motion.button>
        </motion.div>
      )}

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

function SectionHeader({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.div
      className="flex w-full items-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      <div className="h-px flex-1 bg-purple-700/30"></div>
      <span className="text-sm font-bold text-purple-400">{label}</span>
      <div className="h-px flex-1 bg-purple-700/30"></div>
    </motion.div>
  );
}
