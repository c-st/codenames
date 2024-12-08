import { AnimatePresence, Reorder } from "motion/react";
import { useState, useEffect } from "react";
import { Player } from "schema";
import PlayerCard from "../PlayerCard";

export default function TeamTable({
  team,
  onNewSpymaster,
  currentPlayerId,
}: {
  team: Player[];
  currentPlayerId: string;
  onNewSpymaster: (playerId: string) => void;
}) {
  const [sortedTeam, setSortedTeam] = useState<Player[]>([]);
  const [spymasterToPromote, setSpymasterToPromote] = useState<
    Player | undefined
  >();

  useEffect(() => {
    if (team.length === 0) return;
    setSortedTeam([...team].sort((a) => (a.role === "spymaster" ? -1 : 1)));
  }, [team]);

  useEffect(() => {
    if (sortedTeam.length === 0) {
      return;
    }
    const newSpymaster = sortedTeam.at(0);
    if (newSpymaster) {
      if (newSpymaster.role === "spymaster") {
        setSpymasterToPromote(undefined);
      } else {
        setSpymasterToPromote(newSpymaster);
      }
    }
  }, [sortedTeam]);

  return (
    <AnimatePresence>
      <div className="flex flex-col items-center gap-4">
        <div className="flex min-w-32 flex-col gap-2 rounded-lg p-4 shadow-md dark:bg-gray-800">
          <Reorder.Group
            axis="y"
            values={team}
            onReorder={setSortedTeam}
            className="flex flex-col items-center gap-4"
          >
            {sortedTeam.map((player) => {
              return (
                <Reorder.Item
                  key={player.id}
                  value={player}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <PlayerCard
                    player={player}
                    currentPlayerId={currentPlayerId}
                  />
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>
        {spymasterToPromote && (
          <button
            className="btn btn-secondary btn-md text-white"
            onClick={() => onNewSpymaster(spymasterToPromote.id)}
          >
            Make {spymasterToPromote.name} Spymaster
          </button>
        )}
      </div>
    </AnimatePresence>
  );
}
