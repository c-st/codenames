import { z } from "zod";

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("resetGame"),
  }),
  z.object({
    type: z.literal("hello"),
  }),
  z.object({
    type: z.literal("removePlayer"),
    playerId: z.string(),
  }),
]);

export type Command = z.infer<typeof commandSchema>;
