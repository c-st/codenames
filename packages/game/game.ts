import { GameState } from "./schema";

const exampleGameState: GameState = {
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
  winner: undefined,
};

// Validate the example game state
// const result = gameStateSchema.safeParse(exampleGameState);
// if (result.success) {
//   console.log("Game state is valid:", result.data);
// } else {
//   console.error("Game state validation failed:", result.error);
// }
