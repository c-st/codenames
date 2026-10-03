import { z } from "zod";
import { builtInWordPackIds } from "words";
import {
  animalSchema,
  gameStateSchemaForClient,
  reactionEmojiSchema,
} from "./game";

export const wordPackSchema = z.enum([...builtInWordPackIds, "custom"]);
export type WordPackId = z.infer<typeof wordPackSchema>;

export const customWordsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Words cannot be blank.")
      .max(50, "Shorten words longer than 50 characters."),
  )
  .min(25, "Add at least 25 unique words.")
  .max(500, "Use no more than 500 words.")
  .refine(
    (words) =>
      new Set(words.map((word) => word.toLowerCase())).size === words.length,
    {
      message: "Each word must be unique (ignoring capitalization).",
    },
  );

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
  }),
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
