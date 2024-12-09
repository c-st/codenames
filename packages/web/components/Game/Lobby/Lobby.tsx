import { Player } from "schema";
import NameInput from "./NameInput";
import TeamTable from "./TeamTable";

export default function Lobby({
  players,
  currentPlayerId,
  promoteToSpymaster,
  setName,
}: {
  players: Player[];
  currentPlayerId: string;
  promoteToSpymaster: (playerId: string) => void;
  setName: (name: string) => void;
  gameCanBeStarted: boolean;
  startGame: () => void;
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

  return (
    <div className="flex flex-col items-center gap-12">
      <h1 className="text-2xl font-black md:text-4xl">Lobby</h1>
      <div className="flex items-center gap-4">
        <label className="form-control w-full max-w-xs">
          <p className="label text-xl font-bold">Your name</p>
          <NameInput name={currentPlayer.name} setName={setName} />
        </label>
      </div>
      <div>
        <p className="text-xl font-semibold md:text-2xl">
          Your role:{" "}
          {currentPlayer.role === "spymaster" ? "Spymaster" : "Operative"}.
        </p>
      </div>
      <div className="divider"></div>
      <div className="flex flex-wrap justify-center gap-8">
        {Object.keys(teams).map((team) => {
          return (
            <TeamTable
              key={team}
              teamId={parseInt(team)}
              players={teams[parseInt(team)]}
              currentPlayerId={currentPlayerId}
              onNewSpymaster={promoteToSpymaster}
            />
          );
        })}
      </div>
    </div>
  );
}
