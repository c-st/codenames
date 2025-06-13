import type { GameResult, Player, Turn } from "schema";
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
		<div className="flex flex-col items-center justify-center gap-4">
			{!gameResult && gameCanBeStarted && currentPlayer.team === turn?.team && (
				<Button title="End turn" onClick={endTurn} />
			)}
			{!gameResult && (
				<div className="">
					<Button title="End game" type="destructive" onClick={endGame} />
				</div>
			)}
			{!gameCanBeStarted && (
				<div role="alert" className="alert flex flex-col items-start">
					<h2 className="text-xl font-bold">Waiting for more players</h2>
					<p className="text-left text-lg font-medium">
						Each team needs at least one spymaster (giving hints) and one
						operative (guessing).
					</p>
				</div>
			)}
			{gameResult && gameCanBeStarted && (
				<Button title="Start new game" onClick={startGame} />
			)}
			{gameIsRunning && gameResult && gameCanBeStarted && (
				<Button title="Return to lobby" type="destructive" onClick={endGame} />
			)}
		</div>
	);
}
