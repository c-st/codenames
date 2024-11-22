import adjectives from "../resources/adjectives.json";
import animals from "../resources/animals.json";

export const getRandomWord = (words: string[]): string => {
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
};

export const randomAnimal = (): string => {
  const randomAdjective = getRandomWord(adjectives);
  const randomAnimal = getRandomWord(animals);
  return `${randomAdjective}-${randomAnimal}`;
};

export const randomAnimalAlliteration = (): string => {
  const randomAnimal = getRandomWord(animals);
  const randomMatchingAdjective = getRandomWord(
    adjectives.filter((word) => word.charAt(0) === randomAnimal.charAt(0))
  );
  return `${randomMatchingAdjective}-${randomAnimal}`;
};
