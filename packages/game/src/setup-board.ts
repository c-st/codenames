import { getRandomIndices, getRandomWords } from "words";
import { GameParameters } from "./game";
import { WordCard } from "../../schema/src/game";

export const setupBoard = (
  parameters: GameParameters,
  words: string[]
): WordCard[] => {
  const { totalWordCount, teamCount, wordsToGuessCount } = parameters;

  if (words.length < totalWordCount) {
    throw new Error(
      `Not enough words to create a board: ${words.length} < ${totalWordCount}`
    );
  }

  const shuffledWords = getRandomWords(words, totalWordCount);
  const totalRandomIndices = teamCount * wordsToGuessCount + 1;
  const randomIndices = getRandomIndices(totalRandomIndices, totalWordCount);

  // Assign assassin
  const assassinIndex = randomIndices.pop();
  const board: WordCard[] = shuffledWords.map((word, index) => {
    return {
      word,
      isRevealed: false,
      isAssassin: index === assassinIndex,
    };
  });

  // Assign to teams
  for (let team = 0; team < teamCount; team++) {
    for (let count = 0; count < wordsToGuessCount; count++) {
      const wordIndex = randomIndices.pop();
      if (wordIndex !== undefined) {
        board[wordIndex].team = team;
      }
    }
  }

  return board;
};
