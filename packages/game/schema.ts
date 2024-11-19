import { z } from "zod";

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(["red", "blue"]),
  role: z.enum(["spymaster", "operative"]),
});

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

export type GameState = z.infer<typeof gameStateSchema>;

export const toGameState = (json: string): GameState =>
  gameStateSchema.parse(JSON.parse(json));
