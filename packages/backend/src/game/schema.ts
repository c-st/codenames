import { z } from "zod";

// Define the schema for a player
const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(["red", "blue"]),
  role: z.enum(["spymaster", "operative"]),
});

// Define the schema for a word card
const wordCardSchema = z.object({
  word: z.string(),
  type: z.enum(["red", "blue", "neutral", "assassin"]),
  revealed: z.boolean(),
});

// Define the schema for the game state
const gameStateSchema = z.object({
  id: z.string(),
  players: z.array(playerSchema),
  board: z.array(wordCardSchema),
  turn: z.enum(["red", "blue"]),
  status: z.enum(["waiting", "in-progress", "finished"]),
  winner: z.enum(["red", "blue"]).optional(),
});

type GameState = z.infer<typeof gameStateSchema>;

// Example usage
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
const result = gameStateSchema.safeParse(exampleGameState);
if (result.success) {
  console.log("Game state is valid:", result.data);
} else {
  console.error("Game state validation failed:", result.error);
}
