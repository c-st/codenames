import { toGameState, GameState } from "./schema";

const exampleGameState: GameState = {
  teams: ["red", "blue"],
  players: [
    { id: "player-1", name: "Alice", team: "red", role: "spymaster" },
    { id: "player-2", name: "Bob", team: "red", role: "operative" },
    { id: "player-3", name: "Charlie", team: "blue", role: "spymaster" },
    { id: "player-4", name: "Dana", team: "blue", role: "operative" },
  ],
  board: [
    { word: "apple", isAssassin: false, team: 0, isRevealed: false },
    { word: "banana", isAssassin: false, team: 1, isRevealed: false },
    { word: "car", isAssassin: false, isRevealed: false },
    { word: "bomb", isAssassin: true, isRevealed: false },
  ],
  turn: { team: "red", until: new Date() },
};

describe("toGameState", () => {
  it("parses valid JSON to GameState", () => {
    const gameState = toGameState(exampleGameState);

    expect(gameState.players.length).toBe(4);
    expect(gameState.board.length).toBe(4);
    expect(gameState.turn).toStrictEqual({
      team: "red",
      until: expect.any(Date),
    });
  });

  it("makes sure that turn is included in teams", () => {
    const invalidGameState = {
      ...exampleGameState,
      teams: ["red", "blue"],
      turn: "green", // not part of teams
    };

    expect(() => toGameState(invalidGameState)).toThrow();
  });

  it("makes sure that team words reference a valid team", () => {
    const invalidGameState = {
      ...exampleGameState,
      teams: ["red", "blue"],
      board: [{ word: "apple", type: "team", revealed: false }],
    };

    expect(() => toGameState(invalidGameState)).toThrow();
  });

  it("throws an error for invalid JSON", () => {
    const invalidObject = {
      id: "game-123",
      players: [
        { id: "player-1", name: "Alice", team: "red", role: "spymaster" },
      ],
      board: [{ word: "apple", type: "red", revealed: false }],
      turn: "red",
      winner: "none", // invalid
    };

    expect(() => toGameState(invalidObject)).toThrow();
  });
});
