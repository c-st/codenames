import { Player } from "schema";

export default function PlayerCard({
  player,
  currentPlayerId,
}: {
  player: Player;
  currentPlayerId: string;
}) {
  return (
    <div
      key={player.id}
      className={`indicator min-w-48 cursor-pointer select-none rounded-lg p-1 px-2 text-gray-900 drop-shadow-md dark:bg-white ${player.id === currentPlayerId ? "glow" : ""}`}
    >
      {player.role === "spymaster" && (
        <div className="badge indicator-item badge-accent font-bold text-white drop-shadow-md">
          Spymaster
        </div>
      )}
      <span className="text-base font-bold md:text-lg">
        {player.name}
        {player.id === currentPlayerId && " (you!)"}
      </span>
    </div>
  );
}
