import { GameResult, Player, Turn } from "schema";
import { Button } from "../ui/Button";

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
    <div className="flex flex-col justify-center gap-4">
      {!gameResult && gameCanBeStarted && currentPlayer.team === turn?.team && (
        <Button title="End turn" onClick={endTurn} />
      )}
      {!gameResult && gameCanBeStarted && (
        <div className="">
          <Button title="End game" type="destructive" onClick={endGame} />
        </div>
      )}
      {gameResult && gameCanBeStarted && (
        <Button title="Start new game" onClick={startGame} />
      )}
      {gameIsRunning && gameResult && gameCanBeStarted && (
        <>
          <Button
            title="Return to lobby"
            type="destructive"
            onClick={endGame}
          />
        </>
      )}
      {!gameIsRunning && !gameCanBeStarted && (
        <span className="p-2">
          <h2 className="text-xl font-bold">Waiting for more players</h2>
          <p className="text-lg font-medium">
            Each team needs at least one spymaster (giving hints) and one
            operative (guessing).
          </p>
        </span>
      )}
    </div>
  );
}
