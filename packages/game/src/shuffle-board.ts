import { getRandomIndices, getRandomWords } from "words";
import { GameParameters } from "./game";
import { GameError } from "./error";
import { WordCard } from "../../schema/src/game";

export const shuffleBoard = (
  parameters: GameParameters,
  words: string[],
  startingTeam = 0,
): WordCard[] => {
  const { totalWordCount, teamCount } = parameters;
  if (
    !Number.isInteger(totalWordCount) ||
    !Number.isInteger(teamCount) ||
    teamCount < 2 ||
    teamCount > 4 ||
    !Number.isInteger(parameters.wordsToGuessCount) ||
    parameters.wordsToGuessCount < 1 ||
    !Number.isInteger(startingTeam) ||
    startingTeam < 0 ||
    startingTeam >= teamCount
  ) {
    throw new GameError("Invalid board parameters");
  }
  // Reserve an assassin, one extra starting-team word, and at least one neutral.
  const wordsToGuessCount = Math.min(
    parameters.wordsToGuessCount,
    Math.floor((totalWordCount - 3) / teamCount),
  );
  if (wordsToGuessCount < 1)
    throw new GameError("Board is too small for the selected teams");
  const uniqueWords = Array.from(
    new Set(words.map((word) => word.trim()).filter(Boolean)),
  );
  if (uniqueWords.length < totalWordCount) {
    throw new GameError(
      `Not enough words to create a board: ${uniqueWords.length} < ${totalWordCount}`,
    );
  }

  const shuffledWords = getRandomWords(uniqueWords, totalWordCount);
  const totalRandomIndices = teamCount * wordsToGuessCount + 2;
  const randomIndices = getRandomIndices(totalRandomIndices, totalWordCount);

  // Assign assassin
  const assassinIndex = randomIndices.pop();
  const board: WordCard[] = shuffledWords.map((word, index) => {
    return {
      word,
      isAssassin: index === assassinIndex ? true : undefined,
    };
  });

  // Assign to teams
  for (let team = 0; team < teamCount; team++) {
    for (
      let count = 0;
      count < wordsToGuessCount + (team === startingTeam ? 1 : 0);
      count++
    ) {
      const wordIndex = randomIndices.pop();
      if (wordIndex !== undefined) {
        board[wordIndex].team = team;
      }
    }
  }

  return board;
};
