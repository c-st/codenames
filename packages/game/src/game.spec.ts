import { classic as classicWordList } from "words";
import type { GameState } from "../../schema/src/game";
import { GameError } from "./error";
import { Codenames, defaultParameters } from "./game";

const buildExampleGameState = (input: Partial<GameState> = {}): GameState => ({
	players: [
		{ id: "player-1", name: "Alice", team: 0, role: "spymaster" },
		{ id: "player-2", name: "Bob", team: 0, role: "operative" },
		{ id: "player-3", name: "Charlie", team: 1, role: "spymaster" },
		{ id: "player-4", name: "Dana", team: 1, role: "operative" },
	],
	board: [
		{ word: "apple", isAssassin: false, team: 0 },
		{ word: "banana", isAssassin: false, team: 1 },
		{ word: "car", isAssassin: false },
		{ word: "bomb", isAssassin: true },
	],
	turn: {
		team: 0,
		until: new Date(),
		hint: undefined,
	},
	hintHistory: [],
	...input,
});

const onScheduleTurnCallback = vi.fn();

describe("game state updates", () => {
	beforeEach(() => {
		onScheduleTurnCallback.mockReset();
	});

	describe("joining and leaving", () => {
		it("new player joins the game", () => {
			const initialGameState = buildExampleGameState({ players: [] });
			const game = new Codenames(
				initialGameState,
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.joinGame({ id: "player-1", name: "Alice" });

			expect(updatedGameState.players).toEqual([
				{
					id: "player-1",
					name: "Alice",
					team: 0,
					role: "spymaster",
				},
			]);
		});

		it("adds a new player", () => {
			const initialGameState = buildExampleGameState({ players: [] });

			const game = new Codenames(
				initialGameState,
				classicWordList,
				onScheduleTurnCallback,
			);
			game.addOrUpdatePlayer({
				id: "player-1",
				name: "Alice",
				team: 0,
				role: "operative",
			});
			const updatedGameState = game.addOrUpdatePlayer({
				id: "player-2",
				name: "Bob",
				team: 1,
				role: "spymaster",
			});

			expect(updatedGameState.players).toEqual([
				{
					id: "player-1",
					name: "Alice",
					team: 0,
					role: "operative",
				},
				{
					id: "player-2",
					name: "Bob",
					team: 1,
					role: "spymaster",
				},
			]);
		});

		it("does not add duplicate ids when adding players", () => {
			const game = new Codenames(
				buildExampleGameState(),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.addOrUpdatePlayer({
				id: "player-1",
				name: "Alice",
				team: 0,
				role: "operative",
			});

			expect(updatedGameState.players).toHaveLength(4);
		});

		it("removes a player", () => {
			const game = new Codenames(
				buildExampleGameState(),
				classicWordList,
				onScheduleTurnCallback,
			);

			game.removePlayer("player-3");
			const updatedGameState = game.removePlayer("player-1");

			expect(updatedGameState.players).toHaveLength(2);
		});

		it("reassigns spymaster role after player leaving", () => {
			const game = new Codenames(
				buildExampleGameState(),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.removePlayer("player-1");

			const hasRedSpymaster = updatedGameState.players.some(
				(player) => player.team === 0 && player.role === "spymaster",
			);
			expect(hasRedSpymaster).toBeTruthy();
		});

		it("makes sure there is only one spymaster", () => {
			const game = new Codenames(
				buildExampleGameState(),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.addOrUpdatePlayer({
				id: "player-5",
				name: "Eve",
				team: 0,
				role: "spymaster",
			});

			const redSpymasters = updatedGameState.players
				.filter((player) => player.team === 0 && player.role === "spymaster")
				.map((player) => player.id);

			expect(redSpymasters).toHaveLength(1);
			expect(redSpymasters[0]).toEqual("player-5");
		});
	});

	describe("gameplay", () => {
		it("starts new game by shuffling words and initializing turn", () => {
			const game = new Codenames(
				buildExampleGameState({
					turn: undefined,
					board: [],
					hintHistory: [],
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.startGame();

			expect(updatedGameState.players).toHaveLength(4);
			expect(updatedGameState.board).toHaveLength(25);
			expect(updatedGameState.hintHistory).toHaveLength(0);
			expect(updatedGameState.turn).toEqual({
				team: 0,
				until: expect.any(Date),
				hint: undefined,
			});
			expect(onScheduleTurnCallback).toHaveBeenCalled();
		});

		it("clears the previous game state", () => {
			const game = new Codenames(
				buildExampleGameState({
					turn: undefined,
					board: [],
					hintHistory: [
						{ hint: "fruit", count: 2, team: 0, inTurn: 0 },
						{ hint: "animal", count: 2, team: 1, inTurn: 1 },
					],
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.startGame();

			expect(updatedGameState.players).toHaveLength(4);
			expect(updatedGameState.board).toHaveLength(25);
			expect(updatedGameState.board.some((card) => card.revealed)).toBeFalsy();
			expect(updatedGameState.hintHistory).toHaveLength(0);
		});

		it("does not start a new game if the players are not complete", () => {
			// each team needs spymaster and operative
			const game = new Codenames(
				buildExampleGameState({
					players: [
						{ id: "player-1", name: "Alice", team: 0, role: "spymaster" },
						{ id: "player-2", name: "Bob", team: 0, role: "operative" },
						{ id: "player-3", name: "Charlie", team: 1, role: "spymaster" },
					],
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			expect(() => game.startGame()).toThrowError(
				new GameError(
					"Each team needs at least one spymaster and one operative",
				),
			);
		});

		it("advances a turn", () => {
			const game = new Codenames(
				buildExampleGameState(),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.advanceTurn();

			expect(updatedGameState.turn).toEqual({
				team: 1,
				until: expect.any(Date),
				hint: undefined,
			});
			expect(onScheduleTurnCallback).toHaveBeenCalled();
		});

		it("advances a turn with more than 2 teams", () => {
			const game = new Codenames(
				buildExampleGameState({
					players: [
						{ id: "player-1", name: "Alice", team: 0, role: "spymaster" },
						{ id: "player-2", name: "Bob", team: 0, role: "operative" },
						{ id: "player-3", name: "Charlie", team: 1, role: "spymaster" },
						{ id: "player-4", name: "Dana", team: 1, role: "operative" },
						{ id: "player-5", name: "Eve", team: 2, role: "spymaster" },
						{ id: "player-6", name: "Frank", team: 2, role: "operative" },
					],
					board: [
						{ word: "apple", isAssassin: false, team: 0 },
						{ word: "banana", isAssassin: false, team: 1 },
						{
							word: "grapefruit",
							isAssassin: false,
							team: 2,
						},
						{ word: "car", isAssassin: false },
						{ word: "bomb", isAssassin: true },
					],
					turn: {
						team: 1,
						until: new Date(),
						hint: {
							hint: "fruit",
							count: 2,
						},
					},
				}),
				classicWordList,
				onScheduleTurnCallback,
				{
					...defaultParameters,
					teamCount: 3,
				},
			);

			const updatedGameState = game.advanceTurn();
			expect(updatedGameState.turn?.team).toEqual(2);

			const latestGameState = game.advanceTurn();
			expect(latestGameState.turn?.team).toEqual(0);

			expect(onScheduleTurnCallback).toHaveBeenCalledTimes(2);
		});

		it("records a hint", () => {
			const game = new Codenames(
				buildExampleGameState({
					turn: {
						team: 0,
						until: new Date(),
						hint: undefined,
					},
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			const updatedGameState = game.giveHint({ hint: "juicy", count: 1 });

			expect(updatedGameState.turn?.hint).toEqual({
				hint: "juicy",
				count: 1,
			});
			expect(updatedGameState.hintHistory).toEqual([
				{ hint: "juicy", count: 1, team: 0, inTurn: 0 },
			]);
		});

		it("reveals a team word", () => {
			const game = new Codenames(
				buildExampleGameState({
					turn: {
						team: 1,
						until: new Date(),
						hint: {
							hint: "fruit",
							count: 2,
						},
					},
					hintHistory: [
						{ hint: "animal", count: 2, team: 1, inTurn: 0 },
						{ hint: "vegetable", count: 2, team: 0, inTurn: 1 },
						{ hint: "fruit", count: 2, team: 0, inTurn: 2 },
					],
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			game.revealWord("apple");

			const word = game
				.getGameState()
				.board.find((card) => card.word === "apple");

			expect(word?.revealed).toEqual({ byTeam: 1, inTurn: 3 });
			const gameResult = game.getGameResult();
			expect(gameResult).toBeDefined();
			expect(gameResult).toEqual({
				winningTeam: 0,
				losingTeam: undefined,
			});
		});

		it("throws on attempt to reveal word without hint", () => {
			const game = new Codenames(
				buildExampleGameState({
					turn: {
						team: 0,
						until: new Date(),
						hint: undefined,
					},
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			expect(() => game.revealWord("apple")).toThrowError(
				new GameError("Cannot reveal words without a hint"),
			);
		});

		it("throws if advancing on a finished game", () => {
			const game = new Codenames(
				buildExampleGameState({
					turn: {
						team: 0,
						until: new Date(),
						hint: {
							hint: "fruit",
							count: 2,
						},
					},
				}),
				classicWordList,
				onScheduleTurnCallback,
			);

			game.revealWord("apple");
			expect(() => game.advanceTurn()).toThrowError(
				new GameError("Game is already over"),
			);

			const gameResult = game.getGameResult();
			expect(gameResult).toBeDefined();
			expect(gameResult).toEqual({
				winningTeam: 0,
				losingTeam: undefined,
			});
		});

		it("ends game for revealed assassin word", () => {
			const game = new Codenames(
				buildExampleGameState({
					board: [
						{ word: "apple", isAssassin: false, team: 0 },
						{ word: "banana", isAssassin: false, team: 1 },
						{ word: "car", isAssassin: false },
						{
							word: "bomb",
							isAssassin: true,
							revealed: { byTeam: 0, inTurn: 0 },
						},
					],
					turn: {
						team: 1,
						until: new Date(),
						hint: {
							hint: "force",
							count: 1,
						},
					},
				}),
				[],
				onScheduleTurnCallback,
			);

			const gameResult = game.getGameResult();

			expect(gameResult).toEqual({
				winningTeam: undefined,
				losingTeam: 1,
			});
		});
	});
});
