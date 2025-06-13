import { AnimatePresence, motion } from "motion/react";
import type { Player, Turn } from "schema";
import PlayerCard from "../PlayerCard";
import { getTeamColor } from "./getTeamColor";

export default function TeamInfo({
	isGameOver,
	players,
	turn,
	currentPlayer,
	remainingWordsByTeam,
}: {
	isGameOver: boolean;
	players: Player[];
	currentPlayer: Player;
	turn: Turn;
	remainingWordsByTeam: number[];
}) {
	// Group players by team
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
		<div className="flex justify-between">
			<AnimatePresence>
				{Object.entries(teams).map(([teamId, teamPlayers], teamIndex) => (
					<motion.div
						key={teamId}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className={`indicator relative bg-${getTeamColor(teamIndex)}-500 flex flex-col gap-2 rounded-lg p-2 px-2`}
					>
						{turn.team === teamIndex && !isGameOver && (
							<motion.div
								className="badge indicator-item badge-accent indicator-start p-3 px-2 drop-shadow-md"
								initial={{ opacity: 1, x: -50, y: -15 }}
								animate={{ opacity: 1, x: -10, y: -15 }}
								exit={{ opacity: 0, x: 200, y: -15 }}
								transition={{
									type: "spring",
									stiffness: 300,
									damping: 20,
								}}
							>
								<span className="select-none font-bold text-white">
									Now guessing!
								</span>
							</motion.div>
						)}

						<div className="flex items-center justify-between px-2">
							<h2 className="select-none text-lg font-black md:text-xl">
								Team {teamId}
							</h2>
							<motion.span
								key={remainingWordsByTeam[teamIndex]}
								className="select-none text-2xl font-black"
								initial={{ scale: 0 }}
								animate={{ scale: 1.2 }}
								exit={{ scale: 0 }}
								transition={{ type: "spring", stiffness: 300, damping: 20 }}
							>
								{remainingWordsByTeam.at(teamIndex) ?? "?"}
							</motion.span>
						</div>
						<div className="flex flex-col gap-2">
							{teamPlayers
								.sort((a) => (a.role === "spymaster" ? -1 : 1))
								.map((player) => (
									<PlayerCard
										key={player.id}
										player={player}
										currentPlayerId={currentPlayer.id}
									/>
								))}
						</div>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	);
}
