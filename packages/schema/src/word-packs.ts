import { z } from "zod";

export const wordPackIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "Use a valid word pack ID.");
export const wordPackNameSchema = z
  .string()
  .trim()
  .min(1, "Name the word pack.")
  .max(50, "Use a name of at most 50 characters.");

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

export const roomWordPackSchema = z.object({
  id: wordPackIdSchema,
  name: wordPackNameSchema,
  words: customWordsSchema,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type RoomWordPack = z.infer<typeof roomWordPackSchema>;

export const roomWordPacksSchema = z
  .array(roomWordPackSchema)
  .max(30)
  .refine(
    (packs) => new Set(packs.map((pack) => pack.id)).size === packs.length,
    "Word pack IDs must be unique.",
  )
  .refine(
    (packs) =>
      new Set(packs.map((pack) => pack.name.toLowerCase())).size ===
      packs.length,
    "Word pack names must be unique.",
  )
  .refine(
    (packs) =>
      packs.some((pack) => pack.id === "classic" && pack.name === "Classic"),
    "The Classic word pack must be present.",
  )
  .refine(
    (packs) =>
      new TextEncoder().encode(JSON.stringify(packs)).byteLength <= 96 * 1024,
    "The room word pack library exceeds its storage budget.",
  );
