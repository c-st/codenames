import { toGameState, GameState } from "./game";

const exampleGameState: GameState = {
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
  turn: { team: 0, until: new Date() },
  hintHistory: [],
};

describe("toGameState", () => {
  it("parses valid JSON to GameState", () => {
    const gameState = toGameState(exampleGameState);

    expect(gameState.players.length).toBe(4);
    expect(gameState.board.length).toBe(4);
    expect(gameState.turn).toStrictEqual({
      team: 0,
      until: expect.any(Date),
    });
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
