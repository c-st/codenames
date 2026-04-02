import { gameStateSchemaForClient } from "game";
import { z } from "zod";

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ping"),
  }),
  z.object({
    type: z.literal("setName"),
    name: z.string().min(1).max(50),
  }),
  z.object({
    type: z.literal("promoteToSpymaster"),
    playerId: z.string().min(1),
  }),
  z.object({
    type: z.literal("startGame"),
    wordPack: z.enum(["classic", "movies", "food", "geography", "science"]).optional(),
    teamCount: z.number().int().min(2).max(4).optional(),
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
]);

export type Command = z.infer<typeof commandSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
