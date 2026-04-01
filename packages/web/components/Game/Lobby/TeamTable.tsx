import { AnimatePresence, Reorder } from "motion/react";
import { useState, useEffect } from "react";
import { Player } from "schema";
import PlayerCard from "../PlayerCard";
import { getTeamColor } from "../Board/getTeamColor";
import { Button } from "@/components/ui/Button";

export default function TeamTable({
  players,
  teamId,
  onNewSpymaster,
  currentPlayerId,
}: {
  players: Player[];
  teamId: number;
  currentPlayerId: string;
  onNewSpymaster: (playerId: string) => void;
}) {
  const [sortedTeam, setSortedTeam] = useState<Player[]>([]);
  const [spymasterToPromote, setSpymasterToPromote] = useState<
    Player | undefined
  >();

  useEffect(() => {
    if (players.length === 0) return;
    setSortedTeam([...players].sort((a) => (a.role === "spymaster" ? -1 : 1)));
  }, [players]);

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

  const color = getTeamColor(teamId);

  return (
    <AnimatePresence>
      <div className="flex flex-col items-center gap-4">
        <div
          className={`flex min-w-32 flex-col gap-3 rounded-2xl bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} select-none p-4 shadow-md`}
        >
          <h2 className="text-lg font-bold opacity-90 md:text-xl">
            Team {teamId}
          </h2>
          <Reorder.Group
            axis="y"
            values={players}
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
          <Button
            title={`Make ${spymasterToPromote.name} Spymaster`}
            type="secondary"
            onClick={() => onNewSpymaster(spymasterToPromote.id)}
          />
        )}
      </div>
    </AnimatePresence>
  );
}
