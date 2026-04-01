import { AnimatePresence, motion } from "motion/react";
import { GameResult, Player, Turn } from "schema";
import { Button } from "../ui/Button";

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
  endGame,
  startGame,
  endTurn,
}: {
  gameResult?: GameResult;
  gameIsRunning: boolean;
  gameCanBeStarted: boolean;
  currentPlayer: Player;
  turn?: Turn;
  endGame: () => void;
  startGame: () => void;
  endTurn: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <AnimatePresence mode="popLayout">
        {!gameResult && gameCanBeStarted && currentPlayer.team === turn?.team && (
          <MotionWrap key="end-turn">
            <Button title="End turn" onClick={endTurn} />
          </MotionWrap>
        )}
        {!gameResult && (
          <MotionWrap key="end-game">
            <Button title="End game" type="destructive" onClick={endGame} />
          </MotionWrap>
        )}
        {!gameCanBeStarted && (
          <motion.div
            key="waiting"
            className="flex flex-col items-start rounded-2xl border border-purple-700/30 bg-surface p-5 shadow-md"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2 className="text-xl font-bold">Waiting for more players</h2>
            <p className="text-left text-lg font-medium text-purple-300/70">
              Each team needs at least one spymaster (giving hints) and one
              operative (guessing).
            </p>
          </motion.div>
        )}
        {gameResult && gameCanBeStarted && (
          <MotionWrap key="new-game">
            <Button title="Start new game" onClick={startGame} />
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
