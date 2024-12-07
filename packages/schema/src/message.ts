import { gameStateSchemaForClient } from "game";
import { z } from "zod";

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("setName"),
    name: z.string(),
  }),
  z.object({
    type: z.literal("promoteToSpymaster"),
    playerId: z.string(),
  }),
  z.object({
    type: z.literal("startGame"),
  }),
  z.object({
    type: z.literal("giveHint"),
    hint: z.string(),
    count: z.number(),
  }),
  z.object({
    type: z.literal("revealWord"),
    word: z.string(),
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
