import { randomAnimal, randomAnimalAlliteration } from "./random-words";

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
