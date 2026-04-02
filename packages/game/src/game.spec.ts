import { GameState } from "../../schema/src/game";
import { Codenames, defaultParameters } from "./game";
import { classic as classicWordList } from "words";
import { GameError } from "./error";

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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
      );

      game.removePlayer("player-3");
      const updatedGameState = game.removePlayer("player-1");

      expect(updatedGameState.players).toHaveLength(2);
    });

    it("reassigns spymaster role after player leaving", () => {
      const game = new Codenames(
        buildExampleGameState(),
        classicWordList,
        onScheduleTurnCallback
      );

      const updatedGameState = game.removePlayer("player-1");

      const hasRedSpymaster = updatedGameState.players.some(
        (player) => player.team === 0 && player.role === "spymaster"
      );
      expect(hasRedSpymaster).toBeTruthy();
    });

    it("ends the game when all players have left", () => {
      const game = new Codenames(
        buildExampleGameState(),
        classicWordList,
        onScheduleTurnCallback
      );

      game.removePlayer("player-1");
      game.removePlayer("player-2");
      game.removePlayer("player-3");
      const finalState = game.removePlayer("player-4");

      expect(finalState.players).toHaveLength(0);
      expect(finalState.turn).toBeUndefined();
      expect(finalState.board).toHaveLength(0);
    });

    it("makes sure there is only one spymaster", () => {
      const game = new Codenames(
        buildExampleGameState(),
        classicWordList,
        onScheduleTurnCallback
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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
      );

      expect(() => game.startGame()).toThrowError(
        new GameError(
          "Each team needs at least one spymaster and one operative"
        )
      );
    });

    it("advances a turn", () => {
      const game = new Codenames(
        buildExampleGameState(),
        classicWordList,
        onScheduleTurnCallback
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
        }
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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
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
        onScheduleTurnCallback
      );

      expect(() => game.revealWord("apple")).toThrowError(
        new GameError("Cannot reveal words without a hint")
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
        onScheduleTurnCallback
      );

      game.revealWord("apple");
      expect(() => game.advanceTurn()).toThrowError(
        new GameError("Game is already over")
      );

      const gameResult = game.getGameResult();
      expect(gameResult).toBeDefined();
      expect(gameResult).toEqual({
        winningTeam: 0,
        losingTeam: undefined,
      });
    });

    it("throws when revealing an already revealed word", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0, revealed: { byTeam: 1, inTurn: 1 } },
            { word: "banana", team: 1 },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "fruit", count: 1 },
          },
          hintHistory: [{ hint: "fruit", count: 1, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      expect(() => game.revealWord("apple")).toThrowError(
        new GameError("Word already revealed")
      );
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
        onScheduleTurnCallback
      );

      const gameResult = game.getGameResult();

      expect(gameResult).toEqual({
        winningTeam: undefined,
        losingTeam: 1,
      });
    });

    it("auto-advances turn on wrong guess", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "cherry", team: 0 },
            { word: "banana", team: 1 },
            { word: "grape", team: 1 },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "fruit", count: 2 },
          },
          hintHistory: [{ hint: "fruit", count: 2, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      // Reveal opponent's word — should auto-advance to team 1
      const state = game.revealWord("banana");

      expect(state.turn?.team).toBe(1);
      expect(onScheduleTurnCallback).toHaveBeenCalled();
    });

    it("does not advance turn on correct guess", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "banana", team: 1 },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "fruit", count: 2 },
          },
          hintHistory: [{ hint: "fruit", count: 2, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      // Reveal own team's word — turn should NOT advance
      const state = game.revealWord("apple");

      expect(state.turn?.team).toBe(0);
    });

    it("ends game when revealing the assassin", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "banana", team: 1 },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "explosive", count: 1 },
          },
          hintHistory: [{ hint: "explosive", count: 1, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      game.revealWord("bomb");

      const result = game.getGameResult();
      expect(result).toEqual({
        winningTeam: undefined,
        losingTeam: 0,
      });
      // Turn should NOT advance after game-ending reveal
      expect(onScheduleTurnCallback).not.toHaveBeenCalled();
    });

    it("auto-advances turn on neutral word guess", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "banana", team: 1 },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "vehicle", count: 1 },
          },
          hintHistory: [{ hint: "vehicle", count: 1, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      // Reveal neutral word — should auto-advance
      const state = game.revealWord("car");

      expect(state.turn?.team).toBe(1);
    });

    it("throws when giving a hint before game starts", () => {
      const game = new Codenames(
        buildExampleGameState({ turn: undefined }),
        classicWordList,
        onScheduleTurnCallback
      );

      expect(() => game.giveHint({ hint: "test", count: 1 })).toThrowError(
        new GameError("Game has not started yet")
      );
    });

    it("returns remaining words by team correctly", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "cherry", team: 0 },
            { word: "banana", team: 1 },
            { word: "grape", team: 1, revealed: { byTeam: 0, inTurn: 1 } },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      const remaining = game.getRemainingWordsByTeam();

      expect(remaining.get(0)).toBe(2);
      expect(remaining.get(1)).toBe(1); // grape is revealed, only banana remains
    });

    it("clears all state when ending a game", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "banana", team: 1 },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "fruit", count: 1 },
          },
          hintHistory: [{ hint: "fruit", count: 1, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      const state = game.endGame();

      expect(state.turn).toBeUndefined();
      expect(state.board).toHaveLength(0);
      expect(state.hintHistory).toHaveLength(0);
      // Players should still be present
      expect(state.players).toHaveLength(4);
    });

    it("sets guessesRemaining when hint count > 0", () => {
      const game = new Codenames(
        buildExampleGameState({
          turn: { team: 0, until: new Date(), hint: undefined },
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      const state = game.giveHint({ hint: "fruit", count: 2 });

      expect(state.turn?.guessesRemaining).toBe(3); // count + 1
    });

    it("does not set guessesRemaining when hint count is 0", () => {
      const game = new Codenames(
        buildExampleGameState({
          turn: { team: 0, until: new Date(), hint: undefined },
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      const state = game.giveHint({ hint: "fruit", count: 0 });

      expect(state.turn?.guessesRemaining).toBeUndefined();
    });

    it("auto-advances turn when guesses run out on correct guesses", () => {
      const game = new Codenames(
        buildExampleGameState({
          board: [
            { word: "apple", team: 0 },
            { word: "cherry", team: 0 },
            { word: "melon", team: 0 },
            { word: "banana", team: 1 },
            { word: "grape", team: 1 },
            { word: "car" },
            { word: "bomb", isAssassin: true },
          ],
          turn: {
            team: 0,
            until: new Date(),
            hint: { hint: "fruit", count: 1 },
            guessesRemaining: 2,
          },
          hintHistory: [{ hint: "fruit", count: 1, team: 0, inTurn: 0 }],
        }),
        classicWordList,
        onScheduleTurnCallback
      );

      // First correct guess: guessesRemaining 2 -> 1
      game.revealWord("apple");
      expect(game.getGameState().turn?.team).toBe(0); // still team 0

      // Second correct guess: guessesRemaining 1 -> 0, auto-advance
      game.revealWord("cherry");
      expect(game.getGameState().turn?.team).toBe(1); // switched to team 1
    });
  });
});
