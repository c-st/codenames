import { z } from "zod";

const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(["red", "blue"]),
  role: z.enum(["spymaster", "operative"]),
});

const wordCardSchema = z
  .object({
    word: z.string(),
    type: z.enum(["team", "neutral", "assassin"]),
    forTeam: z.string().optional(),
    revealed: z.boolean(),
  })
  .refine((data) => data.type !== "team" || data.forTeam !== undefined, {
    message: "Team needs to be defined if not neutral/assassin word",
  });

const hintSchema = z.object({
  word: z.string(),
  count: z.number(),
});

const turnSchema = z.object({
  team: z.string(),
  until: z.coerce.date(),
  hint: hintSchema.optional(),
});

const gameStateSchema = z
  .object({
    players: z.array(playerSchema),
    teams: z.array(z.string()),
    board: z.array(wordCardSchema),
    turn: turnSchema.optional(),
  })
  .refine((data) => !data.turn || data.teams.includes(data.turn.team), {
    message: "Value must be one of teams",
    path: ["turn", "team"],
  });

export type GameState = z.infer<typeof gameStateSchema>;
export type Hint = z.infer<typeof hintSchema>;

export const toGameState = (object: unknown): GameState =>
  gameStateSchema.parse(object);
