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
      className={`flex min-w-48 cursor-pointer select-none flex-col justify-center rounded-lg p-1 px-2 text-gray-900 dark:bg-white ${player.id === currentPlayerId ? "glow" : "drop-shadow-md"}`}
    >
      <span className="text-base font-bold md:text-lg">
        {player.name}
        {player.id === currentPlayerId && " (you!)"}
        {player.role === "spymaster" && " *"}
      </span>
    </div>
  );
}
