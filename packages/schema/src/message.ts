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
    type: z.literal("removePlayer"),
    playerId: z.string(),
  }),
]);

export type Command = z.infer<typeof commandSchema>;
