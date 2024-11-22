import { GameState } from "./schema";
import { Codenames } from "./game";
import { classic } from "words";

const exampleGameState: GameState = {
  players: [
    { id: "player-1", name: "Alice", team: 0, role: "spymaster" },
    { id: "player-2", name: "Bob", team: 0, role: "operative" },
    { id: "player-3", name: "Charlie", team: 1, role: "spymaster" },
    { id: "player-4", name: "Dana", team: 1, role: "operative" },
  ],
  board: [
    { word: "apple", isAssassin: false, team: 0, isRevealed: false },
    { word: "banana", isAssassin: false, team: 1, isRevealed: false },
    { word: "car", isAssassin: false, isRevealed: false },
    { word: "bomb", isAssassin: true, isRevealed: false },
  ],
  turn: {
    team: 0,
    until: new Date(),
    hint: {
      word: "fruit",
      count: 2,
    },
  },
};

describe("game state updates", () => {
  describe("joining and leaving", () => {
    it("adds a new player", () => {
      const initialGameState = {
        ...exampleGameState,
        players: [],
      };

      const game = new Codenames(initialGameState);
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
      const game = new Codenames(exampleGameState);

      const updatedGameState = game.addOrUpdatePlayer({
        id: "player-1",
        name: "Alice",
        team: 0,
        role: "operative",
      });

      expect(updatedGameState.players).toHaveLength(4);
    });

    it("removes a player", () => {
      const game = new Codenames(exampleGameState);

      game.removePlayer("player-3");
      const updatedGameState = game.removePlayer("player-1");

      expect(updatedGameState.players).toHaveLength(2);
    });

    it("reassigns spymaster role after player leaving", () => {
      const game = new Codenames(exampleGameState);

      const updatedGameState = game.removePlayer("player-1");

      const hasRedSpymaster = updatedGameState.players.some(
        (player) => player.team === 0 && player.role === "spymaster"
      );
      expect(hasRedSpymaster).toBeTruthy();
    });

    it("makes sure there is only one spymaster", () => {
      const game = new Codenames(exampleGameState);

      const updatedGameState = game.addOrUpdatePlayer({
        id: "player-5",
        name: "Eve",
        team: 0,
        role: "spymaster",
      });

      const redSpymasters = updatedGameState.players.filter(
        (player) => player.team === 0 && player.role === "spymaster"
      );

      expect(redSpymasters).toHaveLength(1);
      expect(redSpymasters.at(0)?.id).toEqual("player-5");
    });
  });

  describe("gameplay", () => {
    it("starts new game by shuffling words and initializing turn", () => {
      const game = new Codenames(
        {
          ...exampleGameState,
          turn: undefined,
        },
        classic
      );

      const updatedGameState = game.startGame();

      expect(updatedGameState.board).toBeDefined();
      // expect(updatedGameState.turn).toBeDefined();
    });

    it("does not start a new game if the players are not complete", () => {
      // each team needs spymaster and operative
    });

    it("sets a hint", () => {});

    it("handles guess for team's word", () => {});

    it("handles guess for other team's word", () => {});

    it("handles guess for neutral word", () => {});

    it("handles guess for assassin word", () => {});

    it("advances to next turn on timer", () => {});
  });

  // updating settings
});
