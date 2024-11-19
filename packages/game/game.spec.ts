import { describe, it, expect } from "vitest";
import { toGameState, GameState } from "./schema";

describe("toGameState", () => {
  it("should parse valid JSON to GameState", () => {
    const json = JSON.stringify({
      id: "game-123",
      players: [
        { id: "player-1", name: "Alice", team: "red", role: "spymaster" },
        { id: "player-2", name: "Bob", team: "red", role: "operative" },
        { id: "player-3", name: "Charlie", team: "blue", role: "spymaster" },
        { id: "player-4", name: "Dana", team: "blue", role: "operative" },
      ],
      board: [
        { word: "apple", type: "red", revealed: false },
        { word: "banana", type: "blue", revealed: false },
        { word: "car", type: "neutral", revealed: false },
        { word: "bomb", type: "assassin", revealed: false },
      ],
      turn: "red",
      status: "in-progress",
      winner: "none",
    });

    const gameState: GameState = toGameState(json);
    expect(gameState.id).toBe("game-123");
    expect(gameState.players.length).toBe(4);
    expect(gameState.board.length).toBe(4);
    expect(gameState.turn).toBe("red");
    expect(gameState.status).toBe("in-progress");
    expect(gameState.winner).toBe("none");
  });

  it("should throw an error for invalid JSON", () => {
    const invalidJson = JSON.stringify({
      id: "game-123",
      players: [
        { id: "player-1", name: "Alice", team: "red", role: "spymaster" },
        // Missing required fields
      ],
      board: [{ word: "apple", type: "red", revealed: false }],
      turn: "red",
      status: "in-progress",
    });

    expect(() => toGameState(invalidJson)).toThrow("Invalid game state JSON");
  });
});
