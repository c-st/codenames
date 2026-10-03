import { commandSchema, customWordsSchema } from "./message";

const words = Array.from({ length: 25 }, (_, index) => `Word ${index}`);

describe("custom word pack validation", () => {
  it("normalizes whitespace while preserving display capitalization", () => {
    expect(customWordsSchema.parse(words.map((word) => `  ${word}  `))).toEqual(
      words,
    );
  });

  it("rejects duplicates after trimming and ignoring capitalization", () => {
    expect(customWordsSchema.safeParse([...words, " word 0 "]).success).toBe(
      false,
    );
  });

  it("rejects lists too short for a full board and lists exceeding the limit", () => {
    expect(customWordsSchema.safeParse(words.slice(0, 24)).success).toBe(false);
    expect(
      customWordsSchema.safeParse(
        Array.from({ length: 501 }, (_, index) => `Word ${index}`),
      ).success,
    ).toBe(false);
  });

  it("rejects blank or oversized words", () => {
    expect(customWordsSchema.safeParse([...words, "  "]).success).toBe(false);
    expect(
      customWordsSchema.safeParse([...words, "x".repeat(51)]).success,
    ).toBe(false);
  });

  it("accepts a validated save command and custom pack selection", () => {
    expect(commandSchema.parse({ type: "setCustomWords", words })).toEqual({
      type: "setCustomWords",
      words,
    });
    expect(
      commandSchema.safeParse({ type: "setWordPack", wordPack: "custom" })
        .success,
    ).toBe(true);
  });
});
