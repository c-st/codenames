import { AnimatePresence, motion } from "motion/react";
import { GameResult, Player, Turn } from "schema";
import { Button } from "../ui/Button";
import AnimalAvatar from "../ui/AnimalAvatar";
import { getTeamColor, getTeamName } from "./Board/getTeamColor";
import { getSpymasterTitle } from "./spymasterTitle";

const MotionWrap = ({ children, key: k }: { children: React.ReactNode; key: string }) => (
  <motion.div
    key={k}
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -10, scale: 0.95 }}
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
  >
    {children}
  </motion.div>
);

export default function GameControls({
  gameResult,
  gameIsRunning,
  gameCanBeStarted,
  currentPlayer,
  turn,
  players,
  endGame,
  startGame,
  endTurn,
  promoteToSpymaster,
}: {
  gameResult?: GameResult;
  gameIsRunning: boolean;
  gameCanBeStarted: boolean;
  currentPlayer: Player;
  turn?: Turn;
  players: Player[];
  endGame: () => void;
  startGame: () => void;
  endTurn: () => void;
  promoteToSpymaster: (playerId: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <AnimatePresence mode="popLayout">
        {!gameResult && gameCanBeStarted && currentPlayer.team === turn?.team && (
          <MotionWrap key="end-turn">
            <Button title="End turn" onClick={endTurn} />
          </MotionWrap>
        )}
        {!gameResult && gameIsRunning && (
          <MotionWrap key="end-game">
            <Button title="End game" type="destructive" onClick={endGame} />
          </MotionWrap>
        )}
        {!gameCanBeStarted && gameIsRunning && (
          <motion.div
            key="waiting"
            className="glass-panel flex flex-col items-start p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2 className="text-xl font-bold !text-white">Waiting for more players</h2>
            <p className="text-left text-lg font-medium text-purple-300/70">
              Each team needs at least one spymaster (giving hints) and one
              operative (guessing).
            </p>
          </motion.div>
        )}
        {gameResult && gameIsRunning && (
          <motion.div
            key="role-swap"
            className="glass-panel flex flex-col items-center gap-3 p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          >
            <p className="text-sm font-semibold text-purple-400">
              Swap roles before next game?
            </p>
            <RoleSwapper
              players={players}
              currentPlayerId={currentPlayer.id}
              promoteToSpymaster={promoteToSpymaster}
            />
          </motion.div>
        )}
        {gameIsRunning && gameResult && gameCanBeStarted && (
          <MotionWrap key="new-game">
            <Button title="🔁 Rematch" onClick={startGame} />
          </MotionWrap>
        )}
        {gameIsRunning && gameResult && gameCanBeStarted && (
          <MotionWrap key="return-lobby">
            <Button
              title="Return to lobby"
              type="destructive"
              onClick={endGame}
            />
          </MotionWrap>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleSwapper({
  players,
  currentPlayerId,
  promoteToSpymaster,
}: {
  players: Player[];
  currentPlayerId: string;
  promoteToSpymaster: (playerId: string) => void;
}) {
  const teams = players.reduce(
    (acc, player) => {
      if (!acc[player.team]) acc[player.team] = [];
      acc[player.team].push(player);
      return acc;
    },
    {} as Record<number, Player[]>,
  );

  return (
    <div className="flex flex-wrap justify-center gap-4">
      {Object.entries(teams).map(([teamId, teamPlayers]) => {
        const color = getTeamColor(parseInt(teamId));
        return (
          <div key={teamId} className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-purple-400/70">Team {getTeamName(parseInt(teamId))}</span>
            {teamPlayers
              .sort((a) => (a.role === "spymaster" ? -1 : 1))
              .map((player) => {
                const isSpy = player.role === "spymaster";
                const isYou = player.id === currentPlayerId;
                return (
                  <motion.button
                    key={player.id}
                    className={`flex items-center gap-2 rounded-2xl border py-1 pl-1 pr-3 text-sm font-semibold transition-colors ${
                      isSpy
                        ? "border-amber-300/40 bg-amber-300/10 !text-white"
                        : "border-purple-400/20 bg-elevated !text-white hover:border-purple-400/50"
                    }`}
                    whileHover={!isSpy ? { scale: 1.03 } : {}}
                    whileTap={!isSpy ? { scale: 0.97 } : {}}
                    onClick={() => !isSpy && promoteToSpymaster(player.id)}
                  >
                    <AnimalAvatar
                      animal={player.animal}
                      size="sm"
                      crowned={isSpy}
                      isYou={isYou}
                      glowColor={color.hex}
                    />
                    <span className="truncate">
                      {player.name}
                      {isYou && " (you)"}
                    </span>
                    {isSpy && (
                      <span className="text-[0.6rem] text-amber-300">{getSpymasterTitle()}</span>
                    )}
                    {!isSpy && (
                      <span className="text-[0.6rem] text-purple-400/50">tap to promote</span>
                    )}
                  </motion.button>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
