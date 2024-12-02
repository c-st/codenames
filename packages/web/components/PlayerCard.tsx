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
      className={`flex w-56 min-w-24 cursor-pointer select-none flex-col justify-center rounded-lg bg-gray-200 p-1 px-2 text-gray-900 shadow-md dark:bg-white`}
    >
      <span className="text-base font-bold md:text-lg">
        {player.name}
        {player.id === currentPlayerId && " (you)"}
        {player.role === "spymaster" && " *"}
      </span>
    </div>
  );
}
