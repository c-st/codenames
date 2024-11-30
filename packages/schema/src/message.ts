import { z } from "zod";

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("resetGame"),
  }),
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

  // end game
  // start new game
]);

export type Command = z.infer<typeof commandSchema>;
