import { z } from "zod";

export const animalSchema = z.enum([
  "🦊",
  "🐱",
  "🐶",
  "🐼",
  "🐰",
  "🐻",
  "🦉",
  "🐧",
  "🐨",
  "🐸",
  "🦁",
  "🐢",
  "🐬",
  "🦝",
  "🐝",
  "🦋",
]);
export type Animal = z.infer<typeof animalSchema>;

export const sharedEffectSchema = z.object({
  id: z.string(),
  type: z.enum([
    "correctGuess",
    "wrongGuess",
    "assassinReveal",
    "gameWin",
    "turnChange",
  ]),
  playAt: z.number(),
});
export type SharedEffect = z.infer<typeof sharedEffectSchema>;

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  animal: animalSchema.optional(),
  team: z.number(),
  role: z.enum(["spymaster", "operative"]),
});

const wordCardSchema = z.object({
  word: z.string(),
  team: z.number().optional(),
  isAssassin: z.boolean().optional(),
  revealed: z
    .object({
      byTeam: z.number(),
      inTurn: z.number(),
    })
    .optional(),
});

const hintSchema = z.object({
  hint: z.string(),
  count: z.number(),
});

const turnSchema = z.object({
  team: z.number(),
  until: z.coerce.date(),
  hint: hintSchema.optional(),
  guessesRemaining: z.number().optional(),
});

const hintHistorySchema = z.array(
  hintSchema.extend({
    team: z.number(),
    inTurn: z.number(),
  }),
);

export const gameStateSchema = z.object({
  players: z.array(playerSchema),
  board: z.array(wordCardSchema),
  turn: turnSchema.optional(),
  hintHistory: hintHistorySchema,
});

export const gameResult = z.object({
  winningTeam: z.number().optional(),
  losingTeam: z.number().optional(),
});

export const sessionPlayerSchema = playerSchema.pick({
  id: true,
  name: true,
  animal: true,
});
export type SessionPlayer = z.infer<typeof sessionPlayerSchema>;

export const sessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hint"),
    timestamp: z.number(),
    team: z.number(),
    hint: z.string(),
    count: z.number(),
    spymaster: sessionPlayerSchema.optional(),
  }),
  z.object({
    type: z.literal("guess"),
    timestamp: z.number(),
    team: z.number(),
    word: z.string(),
    outcome: z.enum(["correct", "opponent", "neutral", "assassin"]),
    spymaster: sessionPlayerSchema.optional(),
  }),
]);

export const sessionRoundSchema = z.object({
  id: z.string(),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  status: z.enum(["active", "completed", "aborted"]),
  wordPack: z.string(),
  teamCount: z.number(),
  players: z.array(playerSchema),
  result: gameResult.optional(),
  playersOmitted: z.number().int().nonnegative().optional(),
  events: z.array(sessionEventSchema).max(200),
});

export const sessionHistorySchema = z.object({
  rounds: z.array(sessionRoundSchema).max(50),
  awardSeed: z.string().min(1).optional(),
});

export type SessionEvent = z.infer<typeof sessionEventSchema>;
export type SessionRound = z.infer<typeof sessionRoundSchema>;
export type SessionHistory = z.infer<typeof sessionHistorySchema>;

export const gameStateSchemaForClient = gameStateSchema.extend({
  playerId: z.string(),
  gameCanStart: z.boolean(),
  gameResult: gameResult.optional(),
  remainingWordsByTeam: z.array(z.number()),
  wordPack: z.string().optional(),
  teamCount: z.number().optional(),
  customWords: z.array(z.string()).optional(),
  serverTime: z.number().optional(),
  effects: z.array(sharedEffectSchema).optional(),
  sessionHistory: sessionHistorySchema.optional(),
});

export type GameState = z.infer<typeof gameStateSchema>;
export type GameStateForClient = z.infer<typeof gameStateSchemaForClient>;
export type WordCard = z.infer<typeof wordCardSchema>;
export type Player = z.infer<typeof playerSchema>;
export type Turn = z.infer<typeof turnSchema>;
export type Hint = z.infer<typeof hintSchema>;
export type HintHistory = z.infer<typeof hintHistorySchema>;
export type GameResult = z.infer<typeof gameResult>;

export const toGameState = (object: unknown): GameState =>
  gameStateSchema.parse(object);
