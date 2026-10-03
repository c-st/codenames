type TeamColor = {
  name: string;
  from: string;
  to: string;
  border: string;
  shadow: string;
  badgeFrom: string;
  badgeTo: string;
  /** Raw colour for particles, glows and confetti. */
  hex: string;
  emoji: string;
};

const teamColors: TeamColor[] = [
  {
    name: "purple",
    from: "from-purple-500",
    to: "to-purple-300",
    border: "border-purple-400/40",
    shadow: "card-shadow-purple",
    badgeFrom: "from-purple-800",
    badgeTo: "to-purple-600",
    hex: "#a855f7",
    emoji: "🟣",
  },
  {
    name: "emerald",
    from: "from-emerald-500",
    to: "to-emerald-300",
    border: "border-emerald-400/40",
    shadow: "card-shadow-emerald",
    badgeFrom: "from-emerald-800",
    badgeTo: "to-emerald-600",
    hex: "#10b981",
    emoji: "🟢",
  },
  {
    name: "pink",
    from: "from-pink-500",
    to: "to-pink-300",
    border: "border-pink-400/40",
    shadow: "card-shadow-pink",
    badgeFrom: "from-pink-800",
    badgeTo: "to-pink-600",
    hex: "#ec4899",
    emoji: "🩷",
  },
  {
    name: "blue",
    from: "from-blue-500",
    to: "to-blue-300",
    border: "border-blue-400/40",
    shadow: "card-shadow-blue",
    badgeFrom: "from-blue-800",
    badgeTo: "to-blue-600",
    hex: "#3b82f6",
    emoji: "🔵",
  },
];

export const getTeamColor = (team: number): TeamColor => {
  return teamColors[team] ?? teamColors[3];
};

export const getTeamName = (team: number): string => {
  const color = getTeamColor(team);
  return color.name.charAt(0).toUpperCase() + color.name.slice(1);
};
