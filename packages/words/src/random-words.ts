import adjectives from "../resources/adjectives.json";
import animals from "../resources/animals.json";
import animalEmojis from "../resources/animal-emojis.json";

export const getRandomWords = (words: string[], count: number): string[] =>
	Array.from(new Set(words))
		.sort(() => Math.random() - 0.5)
		.slice(0, count);

export const getRandomWord = (words: string[]): string =>
	getRandomWords(words, 1)[0];

export const randomAnimal = (): string => {
	const randomAdjective = getRandomWord(adjectives);
	const randomAnimal = getRandomWord(animals);
	return `${randomAdjective}-${randomAnimal}`;
};

export const randomAnimalAlliteration = (): string => {
	const randomAnimal = getRandomWord(animals);
	const randomMatchingAdjective = getRandomWord(
		adjectives.filter((word) => word.charAt(0) === randomAnimal.charAt(0)),
	);
	return `${randomMatchingAdjective}-${randomAnimal}`;
};

export const randomAnimalEmoji = (): string => {
	const randomAnimal = getRandomWord(
		animalEmojis.map((entry) => `${entry.emoji} ${entry.name}`),
	);
	return randomAnimal;
};

export const getRandomIndices = (count: number, max: number): number[] => {
	const randomIndices = new Set<number>();
	while (randomIndices.size < count) {
		const randomIndex = Math.floor(Math.random() * max);
		randomIndices.add(randomIndex);
	}
	return Array.from(randomIndices);
};
