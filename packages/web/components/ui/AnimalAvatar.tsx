const sizes = {
  sm: { box: "h-8 w-8", emoji: "text-lg", crown: "-top-2.5 text-xs" },
  md: { box: "h-16 w-16", emoji: "text-4xl", crown: "-top-4 text-xl" },
  lg: {
    box: "h-28 w-28 md:h-36 md:w-36",
    emoji: "text-6xl md:text-7xl",
    crown: "-top-6 text-3xl",
  },
  xl: {
    box: "h-36 w-36 md:h-44 md:w-44",
    emoji: "text-7xl md:text-8xl",
    crown: "-top-7 text-4xl",
  },
};

/**
 * A player's animal as a round, softly lit token. Spymasters wear a bobbing crown,
 * the current player gets a glowing ring, and `glow` adds a breathing halo.
 */
export default function AnimalAvatar({
  animal,
  size = "md",
  crowned = false,
  isYou = false,
  glow = false,
  glowColor,
  className = "",
}: {
  animal?: string;
  size?: keyof typeof sizes;
  crowned?: boolean;
  isYou?: boolean;
  glow?: boolean;
  /** Halo and ring colour, e.g. a team's hex. Defaults to the theme accent. */
  glowColor?: string;
  className?: string;
}) {
  const s = sizes[size];
  const ring = isYou
    ? `0 0 0 3px ${glowColor ?? "#a070e0"}99, 0 0 22px ${glowColor ?? "#a070e0"}88`
    : crowned
      ? "0 0 16px rgba(255, 208, 96, 0.45)"
      : undefined;
  return (
    <span
      aria-hidden="true"
      className={`relative inline-grid shrink-0 place-items-center rounded-full border-2 bg-[radial-gradient(circle_at_50%_35%,_#4a3580,_#1e1638_72%)] ${crowned ? "border-amber-300/90" : "border-white/10"} ${glow ? "halo" : ""} ${s.box} ${className}`}
      style={{
        boxShadow: ring,
        ...(glowColor ? { ["--halo" as string]: `${glowColor}99` } : {}),
      }}
    >
      <span
        className={`relative z-[1] select-none drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)] ${s.emoji}`}
      >
        {animal ?? "🐾"}
      </span>
      {crowned && (
        <span
          className={`animate-crown absolute z-[2] select-none drop-shadow ${s.crown}`}
        >
          👑
        </span>
      )}
    </span>
  );
}
