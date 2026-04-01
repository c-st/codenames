import { randomAnimal, randomAnimalAlliteration, randomAnimalEmoji } from "./random-words";
import { getRandomWords, getRandomIndices } from "./random-words";

import adjectives from "../resources/adjectives.json";
import animals from "../resources/animals.json";

describe("random words", () => {
  it("returns a random animal", () => {
    const result = randomAnimal();
    expect(result).toBeDefined();
  });

  it("returns a random animal alliteration", () => {
    const result = randomAnimalAlliteration();
    expect(result).toBeDefined();
  });

  it.skip("returns many random animal alliterations", () => {
    let concatenatedResult = "";
    for (let i = 0; i < 30; i++) {
      concatenatedResult += randomAnimalAlliteration() + "\n ";
    }
    console.log(concatenatedResult.trim());
  });

  it.skip("finds duplicate words", () => {
    const findDuplicates = (arr: string[]) => {
      const duplicates = arr.filter(
        (item, index) => arr.indexOf(item) !== index
      );
      return [...new Set(duplicates)];
    };

    console.log(findDuplicates(animals));
    console.log(findDuplicates(adjectives));
  });
});

describe("getRandomIndices", () => {
  it("returns the requested number of unique indices within range", () => {
    const result = getRandomIndices(5, 10);
    expect(result).toHaveLength(5);
    expect(new Set(result).size).toBe(5);
    result.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(10);
    });
  });

  it("throws when count exceeds max", () => {
    expect(() => getRandomIndices(10, 5)).toThrow();
  });

  it("returns all indices when count equals max", () => {
    const result = getRandomIndices(5, 5);
    expect(result).toHaveLength(5);
    expect(new Set(result).size).toBe(5);
    result.forEach((idx) => {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5);
    });
  });
});

describe("getRandomWords", () => {
  it("returns the requested number of unique words", () => {
    const words = ["a", "b", "c", "d", "e"];
    const result = getRandomWords(words, 3);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
    result.forEach((word) => expect(words).toContain(word));
  });

  it("handles count larger than available words", () => {
    const words = ["a", "b", "c"];
    const result = getRandomWords(words, 5);
    expect(result).toHaveLength(3);
  });

  it("deduplicates input words", () => {
    const words = ["a", "a", "b", "b", "c"];
    const result = getRandomWords(words, 3);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
  });

  it("returns empty array for empty input", () => {
    const result = getRandomWords([], 5);
    expect(result).toHaveLength(0);
  });
});

describe("randomAnimalEmoji", () => {
  it("returns a string containing an emoji and animal name", () => {
    const result = randomAnimalEmoji();
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    // Format is "emoji name"
    expect(result).toContain(" ");
  });
});
