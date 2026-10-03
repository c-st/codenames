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

export const reactionEmojiSchema = z.enum([
  "😂",
  "😱",
  "🤦",
  "🔥",
  "🤔",
  "👏",
  "😭",
  "🎉",
]);
export type ReactionEmoji = z.infer<typeof reactionEmojiSchema>;

export const sharedEffectSchema = z.object({
  id: z.string(),
  type: z.enum([
    "correctGuess",
    "wrongGuess",
    "assassinReveal",
    "gameWin",
    "turnChange",
    "gameStart",
    "perfectClue",
  ]),
  playAt: z.number(),
  /** Team whose turn starts (turnChange/gameStart) or who earned the cue. */
  team: z.number().optional(),
  /** Card the cue belongs to, for reveal cues. */
  word: z.string().optional(),
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
      byPlayer: z.string().optional(),
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

export const cardMarkSchema = z.object({
  word: z.string(),
  playerId: z.string(),
});
export type CardMark = z.infer<typeof cardMarkSchema>;

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
  /** Operatives' tentative picks for the current turn. */
  marks: z.array(cardMarkSchema).optional(),
  turnSeconds: z.number().optional(),
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
