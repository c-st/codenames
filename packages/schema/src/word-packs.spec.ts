import { wordPacks } from "words";
import { commandSchema, gameEventSchema } from "./message";
import { roomWordPackSchema, roomWordPacksSchema } from "./word-packs";

const words = Array.from({ length: 25 }, (_, number) => `Word ${number}`);
const defaults = Object.entries(wordPacks).map(([id, entries]) => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  words: entries,
  revision: 0,
}));
const packId = "room-00000000-0000-4000-8000-000000000001";

describe("shared room word pack schemas", () => {
  it("validates the actual built-in library and normalizes edited names and words", () => {
    expect(roomWordPacksSchema.parse(defaults)).toHaveLength(10);
    expect(
      roomWordPackSchema.parse({
        id: packId,
        name: "  Friends  ",
        words: words.map((word) => `  ${word}  `),
        revision: 1,
      }),
    ).toEqual({ id: packId, name: "Friends", words, revision: 1 });
  });

  it("requires a Classic pack with its fixed name and unique pack ids and names", () => {
    expect(
      roomWordPacksSchema.safeParse(
        defaults.filter((pack) => pack.id !== "classic"),
      ).success,
    ).toBe(false);
    expect(
      roomWordPacksSchema.safeParse(
        defaults.map((pack) =>
          pack.id === "classic" ? { ...pack, name: "Renamed" } : pack,
        ),
      ).success,
    ).toBe(false);
    expect(
      roomWordPacksSchema.safeParse([
        ...defaults,
        { id: "classic", name: "Other", words, revision: 0 },
      ]).success,
    ).toBe(false);
    expect(
      roomWordPacksSchema.safeParse([
        ...defaults,
        { id: packId, name: " fOoD ", words, revision: 0 },
      ]).success,
    ).toBe(false);
  });

  it("rejects invalid ids, revisions and lists", () => {
    for (const value of [
      { id: "../escape", name: "Friends", words, revision: 0 },
      { id: packId, name: "Friends", words, revision: -1 },
      { id: packId, name: "Friends", words, revision: 1.5 },
      { id: packId, name: "Friends", words: [...words, "word 0"], revision: 0 },
    ])
      expect(roomWordPackSchema.safeParse(value).success).toBe(false);
  });

  it("enforces both thirty-pack and Unicode-aware byte budgets", () => {
    const added = Array.from({ length: 21 }, (_, number) => ({
      id: `room-${number}`,
      name: `Added ${number}`,
      words,
      revision: 1,
    }));
    expect(roomWordPacksSchema.safeParse([...defaults, ...added]).success).toBe(
      false,
    );
    const heavyWords = Array.from(
      { length: 500 },
      (_, number) => `${String(number).padStart(4, "0")}-${"🍎".repeat(22)}`,
    );
    expect(
      roomWordPacksSchema.safeParse([
        ...defaults,
        { id: "room-first", name: "First", words: heavyWords, revision: 1 },
        { id: "room-second", name: "Second", words: heavyWords, revision: 1 },
      ]).success,
    ).toBe(false);
  });

  it("supports optimistic save commands and correlated success/conflict responses", () => {
    const save = {
      type: "saveWordPack",
      packId,
      name: "Friends",
      words,
      expectedRevision: 0,
      requestId: "request-1",
    };
    expect(commandSchema.parse(save)).toEqual(save);
    expect(
      commandSchema.safeParse({ ...save, expectedRevision: 1.5 }).success,
    ).toBe(false);
    expect(commandSchema.safeParse({ ...save, requestId: "" }).success).toBe(
      false,
    );
    expect(
      commandSchema.parse({ type: "setWordPack", wordPack: packId }),
    ).toEqual({ type: "setWordPack", wordPack: packId });
    expect(
      gameEventSchema.parse({
        type: "wordPackSaved",
        requestId: "request-1",
        packId,
        revision: 1,
      }).type,
    ).toBe("wordPackSaved");
    expect(
      gameEventSchema.parse({
        type: "wordPackSaveRejected",
        requestId: "request-1",
        packId,
        reason: "Changed",
        code: "conflict",
        currentRevision: 1,
      }).type,
    ).toBe("wordPackSaveRejected");
    expect(
      gameEventSchema.parse({
        type: "wordPackSaveRejected",
        requestId: "request-1",
        packId,
        reason: "Please retry",
        code: "storage_error",
        currentRevision: 0,
      }).type,
    ).toBe("wordPackSaveRejected");
  });
});
