import { wordPacks } from "./index";

const packs = wordPacks;

describe("built-in word packs", () => {
  for (const [name, words] of Object.entries(packs)) {
    it(`${name} can produce a complete board without blank or duplicate words`, () => {
      expect(words.length).toBeGreaterThanOrEqual(25);
      const normalized = words.map((word) => word.trim().toLowerCase());
      expect(new Set(normalized).size).toBe(words.length);
      for (const word of words) {
        expect(word).toBe(word.trim());
        expect(word.length).toBeGreaterThan(0);
        expect(word.length).toBeLessThanOrEqual(50);
      }
    });
  }
});
