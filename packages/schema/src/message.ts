import { z } from "zod";
import {
  customWordsSchema,
  wordPackIdSchema,
  wordPackNameSchema,
} from "./word-packs";
import {
  animalSchema,
  gameStateSchemaForClient,
  reactionEmojiSchema,
} from "./game";

export const wordPackSchema = wordPackIdSchema;
export type WordPackId = z.infer<typeof wordPackSchema>;
export { customWordsSchema } from "./word-packs";

export const saveWordPackCommandSchema = z.object({
  type: z.literal("saveWordPack"),
  packId: wordPackIdSchema,
  name: wordPackNameSchema,
  words: customWordsSchema,
  expectedRevision: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
  requestId: z.string().min(1).max(100),
});

// Enough routing information to acknowledge invalid saves without trusting their contents.
export const saveWordPackEnvelopeSchema = z.object({
  type: z.literal("saveWordPack"),
  packId: z.string().min(1).max(64),
  requestId: z.string().min(1).max(100),
});

export const wordPackSaveRejectedSchema = z.object({
  type: z.literal("wordPackSaveRejected"),
  requestId: z.string(),
  packId: z.string(),
  reason: z.string(),
  code: z.enum([
    "conflict",
    "invalid",
    "game_running",
    "limit",
    "storage_error",
  ]),
  currentRevision: z.number().optional(),
});
export type WordPackSaveRejected = z.infer<typeof wordPackSaveRejectedSchema>;

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ping"),
  }),
  z.object({
    type: z.literal("setProfile"),
    name: z.string().trim().min(1).max(50),
    animal: animalSchema,
  }),
  z.object({
    type: z.literal("shuffleTeams"),
  }),
  z.object({
    type: z.literal("promoteToSpymaster"),
    playerId: z.string().min(1),
  }),
  z.object({
    type: z.literal("startGame"),
  }),
  z.object({
    type: z.literal("giveHint"),
    hint: z.string().min(1).max(100),
    count: z.number().int().min(0).max(25),
  }),
  z.object({
    type: z.literal("revealWord"),
    word: z.string().min(1),
  }),
  z.object({
    type: z.literal("endTurn"),
  }),
  z.object({
    type: z.literal("endGame"),
  }),
  z.object({
    type: z.literal("randomizeName"),
  }),
  z.object({
    type: z.literal("setWordPack"),
    wordPack: wordPackSchema,
  }),
  z.object({
    type: z.literal("setCustomWords"),
    words: customWordsSchema,
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1)
      .optional(),
  }),
  saveWordPackCommandSchema,
  z.object({
    type: z.literal("setTeamCount"),
    teamCount: z.number().int().min(2).max(4),
  }),
  z.object({
    type: z.literal("react"),
    emoji: reactionEmojiSchema,
  }),
  z.object({
    type: z.literal("markCard"),
    word: z.string().min(1),
  }),
  z.object({
    type: z.literal("typing"),
    typing: z.boolean(),
  }),
]);

export const gameEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("wordPackSaved"),
    requestId: z.string(),
    packId: z.string(),
    revision: z.number(),
  }),
  wordPackSaveRejectedSchema,
  z.object({
    type: z.literal("gameStateUpdated"),
    gameState: gameStateSchemaForClient,
  }),
  z.object({
    type: z.literal("commandRejected"),
    reason: z.string(),
  }),
  // Ephemeral events: broadcast once and never stored.
  z.object({
    type: z.literal("reaction"),
    id: z.string(),
    playerId: z.string(),
    emoji: reactionEmojiSchema,
  }),
  z.object({
    type: z.literal("typing"),
    playerId: z.string(),
    typing: z.boolean(),
  }),
]);

export type Command = z.infer<typeof commandSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
