import { isValid, z } from "zod";

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

const hintSchema = z.object({
  word: z.string(),
  count: z.number(),
});

const turnSchema = z.object({
  team: z.string(),
  until: z.coerce.date(),
});

const gameStateSchema = z
  .object({
    id: z.string(),
    players: z.array(playerSchema),
    teams: z.array(z.string()),
    board: z.array(wordCardSchema),
    turn: turnSchema.optional(),
    hint: hintSchema.optional(),
    winner: z.enum(["red", "blue"]).optional(),
  })
  .refine((data) => !data.turn || data.teams.includes(data.turn.team), {
    message: "Value must be one of teams",
    path: ["turn", "team"],
  });

export type GameState = z.infer<typeof gameStateSchema>;

export const toGameState = (object: unknown): GameState =>
  gameStateSchema.parse(object);
