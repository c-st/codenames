type TeamColor = {
  name: string;
  from: string;
  to: string;
  border: string;
  shadow: string;
  badgeFrom: string;
  badgeTo: string;
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
  },
  {
    name: "emerald",
    from: "from-emerald-500",
    to: "to-emerald-300",
    border: "border-emerald-400/40",
    shadow: "card-shadow-emerald",
    badgeFrom: "from-emerald-800",
    badgeTo: "to-emerald-600",
  },
  {
    name: "pink",
    from: "from-pink-500",
    to: "to-pink-300",
    border: "border-pink-400/40",
    shadow: "card-shadow-pink",
    badgeFrom: "from-pink-800",
    badgeTo: "to-pink-600",
  },
  {
    name: "blue",
    from: "from-blue-500",
    to: "to-blue-300",
    border: "border-blue-400/40",
    shadow: "card-shadow-blue",
    badgeFrom: "from-blue-800",
    badgeTo: "to-blue-600",
  },
  {
    name: "amber",
    from: "from-amber-500",
    to: "to-amber-300",
    border: "border-amber-400/40",
    shadow: "card-shadow-amber",
    badgeFrom: "from-amber-800",
    badgeTo: "to-amber-600",
  },
  {
    name: "cyan",
    from: "from-cyan-500",
    to: "to-cyan-300",
    border: "border-cyan-400/40",
    shadow: "card-shadow-cyan",
    badgeFrom: "from-cyan-800",
    badgeTo: "to-cyan-600",
  },
  {
    name: "rose",
    from: "from-rose-500",
    to: "to-rose-300",
    border: "border-rose-400/40",
    shadow: "card-shadow-rose",
    badgeFrom: "from-rose-800",
    badgeTo: "to-rose-600",
  },
  {
    name: "teal",
    from: "from-teal-500",
    to: "to-teal-300",
    border: "border-teal-400/40",
    shadow: "card-shadow-teal",
    badgeFrom: "from-teal-800",
    badgeTo: "to-teal-600",
  },
];

export const getTeamColor = (team: number): TeamColor => {
  return teamColors[team] ?? teamColors[3];
};
