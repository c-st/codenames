import { z } from "zod";

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.number(),
  role: z.enum(["spymaster", "operative"]),
});

const wordCardSchema = z.object({
  word: z.string(),
  isRevealed: z.boolean(),
  isAssassin: z.boolean(),
  team: z.number().optional(),
});

const hintSchema = z.object({
  word: z.string(),
  count: z.number(),
});

const turnSchema = z.object({
  team: z.number(),
  until: z.coerce.date(),
  hint: hintSchema.optional(),
});

export const gameStateSchema = z.object({
  players: z.array(playerSchema),
  board: z.array(wordCardSchema),
  turn: turnSchema.optional(),
});

export const gameStateSchemaForClient = gameStateSchema.extend({
  playerId: z.string(),
  gameCanStart: z.boolean(),
});

export type GameState = z.infer<typeof gameStateSchema>;
export type GameStateForClient = z.infer<typeof gameStateSchemaForClient>;
export type WordCard = z.infer<typeof wordCardSchema>;
export type Player = z.infer<typeof playerSchema>;
export type Turn = z.infer<typeof turnSchema>;
export type Hint = z.infer<typeof hintSchema>;

export const toGameState = (object: unknown): GameState =>
  gameStateSchema.parse(object);
