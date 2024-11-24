import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { gameStateSchema, playerSchema } from "game";

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addPlayer"),
    player: playerSchema,
  }),
  z.object({
    type: z.literal("removePlayer"),
    playerId: z.string(),
  }),
]);

export const messageSchema = z.object({
  id: z.string().default(() => uuidv4()),
  timestamp: z.string().default(new Date().toISOString()),
  type: commandSchema.optional(),
  state: gameStateSchema.optional(),
});

export type Message = z.infer<typeof messageSchema>;
