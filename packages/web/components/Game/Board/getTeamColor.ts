export const getTeamColor = (team: number) => {
  switch (team) {
    case 0:
      return "purple";
    case 1:
      return "green";
    case 2:
      return "pink";
    default:
      return "blue";
  }
};
