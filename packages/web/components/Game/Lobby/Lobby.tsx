import { useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Animal, Player, WordPackId } from "schema";
import AnimalAvatar from "@/components/ui/AnimalAvatar";
import ProfileSheet from "./ProfileSheet";
import WordPackEditor from "./WordPackEditor";
import { getTeamColor, getTeamName } from "../Board/getTeamColor";
import { getSpymasterTitle } from "../spymasterTitle";

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
  { id: "custom", label: "Custom", emoji: "✏️" },
];

const TEAM_COUNTS = [2, 3, 4];

const chip = (active: boolean) =>
  `rounded-xl border px-4 py-2 text-sm font-bold transition-[background,box-shadow,border-color] ${
    active
      ? "border-transparent bg-gradient-to-br from-primary to-accent !text-white shadow-[0_0_18px_rgba(160,112,224,0.45)]"
      : "border-purple-400/20 bg-elevated !text-white hover:border-purple-400/50 hover:shadow-[0_8px_18px_-8px_rgba(160,112,224,0.7)] disabled:cursor-not-allowed disabled:opacity-40"
  }`;

/** The waiting room as an arena: teams face off around a glowing medallion. */
export default function Lobby({
  players,
  currentPlayerId,
  promoteToSpymaster,
  setProfile,
  randomizeName,
  startGame,
  gameCanBeStarted,
  wordPack,
  teamCount,
  setWordPack,
  setTeamCount,
  customWords,
  setCustomWords,
  shuffleTeams,
  shuffling = false,
  roomId,
  onBackToHome,
}: {
  players: Player[];
  currentPlayerId: string;
  promoteToSpymaster: (playerId: string) => void;
  setProfile: (name: string, animal: Animal) => void;
  randomizeName: () => void;
  gameCanBeStarted: boolean;
  startGame: () => void;
  wordPack: WordPackId;
  teamCount: number;
  setWordPack: (pack: WordPackId) => void;
  setTeamCount: (count: number) => void;
  customWords?: string[];
  setCustomWords: (words: string[]) => void;
  shuffleTeams: () => void;
  /** A shared shuffle countdown is running. */
  shuffling?: boolean;
  roomId?: string;
  onBackToHome?: () => void;
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  if (!currentPlayer) {
    return null;
  }

  // Every team shows up, even before anyone is on it.
  const teamIds = Array.from(
    new Set([
      ...Array.from({ length: teamCount }, (_, i) => i),
      ...players.map((p) => p.team),
    ]),
  ).sort((a, b) => a - b);
  const teams = teamIds.map((team) => ({
    team,
    players: players
      .filter((p) => p.team === team)
      .sort(
        (a, b) =>
          Number(b.role === "spymaster") - Number(a.role === "spymaster"),
      ),
  }));
  const faceOff = teams.length === 2;

  const medallion = (
    <Medallion
      key="medallion"
      teamColors={teamIds.map((t) => getTeamColor(t).hex)}
      gameCanBeStarted={gameCanBeStarted}
      shuffling={shuffling}
      startGame={startGame}
      shuffleTeams={shuffleTeams}
    />
  );
  const teamPanels = teams.map(({ team, players: teamPlayers }, i) => (
    <TeamPanel
      key={team}
      team={team}
      index={i}
      players={teamPlayers}
      currentPlayerId={currentPlayerId}
      onPlayer={(player) => {
        if (player.id === currentPlayerId) setEditingProfile(true);
        else if (player.role !== "spymaster") promoteToSpymaster(player.id);
      }}
    />
  ));

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button
        type="button"
        className="glass-panel flex items-center gap-3 !rounded-full py-1.5 pl-1.5 pr-5 text-sm font-bold text-purple-100 hover:border-purple-400/50"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setEditingProfile(true)}
      >
        <AnimalAvatar animal={currentPlayer.animal} size="sm" />
        ✏️ Change your name or animal
      </motion.button>

      <LayoutGroup>
        <div
          className={`grid w-full items-stretch gap-4 ${faceOff ? "md:grid-cols-[1fr_auto_1fr]" : "md:grid-cols-2"}`}
        >
          {faceOff ? [teamPanels[0], medallion, teamPanels[1]] : teamPanels}
          {!faceOff && <div className="md:col-span-2">{medallion}</div>}
        </div>
      </LayoutGroup>

      <motion.section
        aria-label="Game settings"
        className="glass-panel flex w-full flex-col gap-5 p-5 md:p-6"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
            Word pack
          </span>
          <div className="flex flex-wrap gap-2">
            {WORD_PACKS.map((pack) => (
              <motion.button
                key={pack.id}
                disabled={pack.id === "custom" && !customWords?.length}
                title={
                  pack.id === "custom" && !customWords?.length
                    ? "Save a custom word list below first"
                    : undefined
                }
                className={chip(wordPack === pack.id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setWordPack(pack.id)}
              >
                {pack.emoji} {pack.label}
              </motion.button>
            ))}
          </div>
        </div>
        <WordPackEditor
          words={customWords}
          onSave={setCustomWords}
          roomId={roomId}
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
            Number of teams
          </span>
          <div className="flex flex-wrap gap-2">
            {TEAM_COUNTS.map((count) => {
              const needsPlayers = count * 2;
              const hasEnough = players.length >= needsPlayers;
              return (
                <motion.button
                  key={count}
                  className={chip(teamCount === count)}
                  disabled={!hasEnough && teamCount !== count}
                  whileHover={hasEnough ? { y: -2 } : {}}
                  whileTap={hasEnough ? { scale: 0.96 } : {}}
                  onClick={() => hasEnough && setTeamCount(count)}
                >
                  {count} teams
                  {!hasEnough && (
                    <span className="ml-1 text-[0.6rem] opacity-70">
                      ({needsPlayers}+)
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.section>

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

      <ProfileSheet
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        player={currentPlayer}
        others={players.filter((p) => p.id !== currentPlayerId)}
        setProfile={setProfile}
        onRandomize={randomizeName}
        onBecomeSpymaster={() => promoteToSpymaster(currentPlayerId)}
      />
    </motion.div>
  );
}

function TeamPanel({
  team,
  index,
  players,
  currentPlayerId,
  onPlayer,
}: {
  team: number;
  index: number;
  players: Player[];
  currentPlayerId: string;
  onPlayer: (player: Player) => void;
}) {
  const color = getTeamColor(team);
  return (
    <motion.section
      aria-label={`Team ${getTeamName(team)}`}
      className="glass-panel glass-wash flex min-h-56 flex-col items-center gap-5 px-3 py-5"
      style={{ ["--wash" as string]: color.hex }}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 22,
        delay: 0.1 + index * 0.08,
      }}
    >
      <h2
        className="relative text-2xl font-black tracking-wide"
        style={{ color: color.hex, textShadow: `0 0 18px ${color.hex}` }}
      >
        Team {getTeamName(team)}
      </h2>
      <div className="relative flex flex-wrap justify-center gap-x-2 gap-y-4">
        {players.map((player, i) => (
          <PlayerToken
            key={player.id}
            player={player}
            index={i}
            isYou={player.id === currentPlayerId}
            teamHex={color.hex}
            onClick={() => onPlayer(player)}
          />
        ))}
        {players.length === 0 && (
          <p className="py-6 text-sm font-semibold text-purple-300/60">
            Waiting for players…
          </p>
        )}
      </div>
    </motion.section>
  );
}

function PlayerToken({
  player,
  index,
  isYou,
  teamHex,
  onClick,
}: {
  player: Player;
  index: number;
  isYou: boolean;
  teamHex: string;
  onClick: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isSpy = player.role === "spymaster";
  const action = isYou
    ? "edit your profile"
    : isSpy
      ? getSpymasterTitle()
      : `promote to ${getSpymasterTitle()}`;
  return (
    // layoutId lets a shuffled player fly across to their new team.
    <motion.button
      layoutId={`player-${player.id}`}
      type="button"
      aria-label={`${player.name}${isYou ? " (you)" : ""}, ${action}`}
      className={`group flex w-24 flex-col items-center gap-1.5 rounded-2xl p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isSpy && !isYou ? "cursor-default" : "cursor-pointer"}`}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      whileHover={!isSpy || isYou ? { y: -4 } : undefined}
      whileTap={!isSpy || isYou ? { scale: 0.94 } : undefined}
      onClick={onClick}
    >
      <motion.span
        className="relative"
        animate={reduceMotion ? undefined : { y: [0, -5, 0] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: (index % 3) * 1.3,
        }}
      >
        <AnimalAvatar
          animal={player.animal}
          crowned={isSpy}
          isYou={isYou}
          glow={isYou}
          glowColor={teamHex}
        />
        {isYou && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 z-[3] grid h-6 w-6 place-items-center rounded-full border border-purple-300/40 bg-elevated text-xs shadow-md"
          >
            ✏️
          </span>
        )}
      </motion.span>
      <span className="max-w-full truncate text-sm font-bold !text-white">
        {player.name}
      </span>
      <span
        className={`text-[0.65rem] font-bold uppercase tracking-wider ${isSpy ? "text-amber-300" : "text-purple-400/70 group-hover:text-purple-200"}`}
      >
        {isSpy ? getSpymasterTitle() : isYou ? "Operative" : "Promote"}
      </span>
      {isYou && (
        <span className="rounded-full bg-purple-400/20 px-2 text-[0.6rem] font-bold uppercase tracking-wider text-purple-100">
          You
        </span>
      )}
    </motion.button>
  );
}

function Medallion({
  teamColors,
  gameCanBeStarted,
  shuffling,
  startGame,
  shuffleTeams,
}: {
  teamColors: string[];
  gameCanBeStarted: boolean;
  shuffling: boolean;
  startGame: () => void;
  shuffleTeams: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const ring = `conic-gradient(from 0deg, transparent 0 40%, ${teamColors.join(", ")}, #ffd060, transparent)`;
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-5 py-4 md:px-4"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
    >
      <div className="relative grid h-32 w-32 place-items-center md:h-36 md:w-36">
        <motion.div
          aria-hidden="true"
          className="absolute -inset-3 rounded-full [mask:radial-gradient(circle,transparent_62%,#000_63%)]"
          style={{ background: ring }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
        <div className="grid h-full w-full select-none place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,_#4a3580,_#1e1638_70%)] text-5xl font-black !text-white shadow-[0_0_60px_rgba(160,112,224,0.55),inset_0_-10px_30px_rgba(0,0,0,0.4)]">
          VS
        </div>
      </div>

      {gameCanBeStarted ? (
        <motion.button
          className="sheen rounded-2xl bg-gradient-to-br from-primary to-accent px-8 py-4 text-xl font-black !text-white shadow-[0_14px_40px_-10px_rgba(160,112,224,0.8)] disabled:opacity-50"
          disabled={shuffling}
          whileHover={{ y: -2, scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => startGame()}
        >
          Start Game
        </motion.button>
      ) : (
        <p className="max-w-48 text-center text-sm font-semibold text-purple-300/80">
          Each team needs a spymaster and an operative to start.
        </p>
      )}

      <motion.button
        type="button"
        onClick={shuffleTeams}
        disabled={shuffling}
        className="flex items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-5 py-2.5 text-sm font-bold text-amber-100 shadow-[0_0_18px_rgba(255,208,96,0.2)] hover:bg-amber-300/20 disabled:opacity-60"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.span
          aria-hidden="true"
          animate={shuffling && !reduceMotion ? { rotate: 360 } : { rotate: 0 }}
          transition={
            shuffling
              ? { duration: 0.6, repeat: Infinity, ease: "linear" }
              : undefined
          }
        >
          🎲
        </motion.span>
        Shuffle teams & spymasters
      </motion.button>
    </motion.div>
  );
}
