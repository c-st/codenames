import { AnimatePresence, motion } from "motion/react";
import { getTeamColor, getTeamName } from "../Game/Board/getTeamColor";

export type Banner = {
  id: string;
  kind: "turn" | "start" | "perfect";
  team?: number;
};

/** A full-width ribbon that swooshes across the screen for big moments. */
export default function TurnBanner({
  banner,
  lastBanner,
  myTeam,
}: {
  banner?: Banner;
  lastBanner?: Banner;
  myTeam?: number;
}) {
  return (
    <div
      aria-live="polite"
      data-last-banner={lastBanner?.kind}
      data-last-banner-id={lastBanner?.id}
      data-last-banner-team={lastBanner?.team}
      className="pointer-events-none fixed inset-x-0 top-1/3 z-40 flex justify-center overflow-hidden"
    >
      <AnimatePresence>
        {banner && (
          <Ribbon
            key={banner.id}
            banner={banner}
            isMine={banner.team !== undefined && banner.team === myTeam}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Ribbon({ banner, isMine }: { banner: Banner; isMine: boolean }) {
  const color =
    banner.team !== undefined ? getTeamColor(banner.team) : undefined;
  const name = banner.team !== undefined ? getTeamName(banner.team) : "";
  const title = {
    turn: `${color?.emoji ?? ""} ${name}'s turn!`,
    start: `🎬 ${name} starts!`,
    perfect: "🎯 Perfect clue!",
  }[banner.kind];
  const subtitle =
    banner.kind === "perfect"
      ? "Every word found. Spymaster big brain 🧠"
      : isMine
        ? "That's you — let's go!"
        : "Sit tight and look innocent 😇";

  return (
    <motion.div
      className="w-full py-4 text-center shadow-2xl"
      style={{
        background:
          banner.kind === "perfect"
            ? "linear-gradient(90deg, #f59e0b, #fde047, #f59e0b)"
            : `linear-gradient(90deg, transparent, ${color?.hex ?? "#8060c0"} 15%, ${color?.hex ?? "#8060c0"} 85%, transparent)`,
      }}
      initial={{ x: "-110%", skewX: -12 }}
      animate={{ x: 0, skewX: 0 }}
      exit={{ x: "110%", skewX: 12, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <motion.p
        className={`text-3xl font-black drop-shadow-md md:text-5xl ${banner.kind === "perfect" ? "!text-amber-950" : "!text-white"}`}
        initial={{ scale: 0.6 }}
        animate={{ scale: [0.6, 1.12, 1] }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {title}
      </motion.p>
      <p
        className={`mt-1 text-sm font-bold md:text-base ${banner.kind === "perfect" ? "!text-amber-900" : "!text-white/80"}`}
      >
        {subtitle}
      </p>
    </motion.div>
  );
}
