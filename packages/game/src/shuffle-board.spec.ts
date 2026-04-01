import { shuffleBoard } from "./shuffle-board";
import { defaultParameters } from "./game";
import { classic as classicWordList } from "words";

describe("shuffleBoard", () => {
  it("creates a board with the correct number of words", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    expect(board).toHaveLength(25);
  });

  it("assigns exactly one assassin card", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    const assassins = board.filter((card) => card.isAssassin);
    expect(assassins).toHaveLength(1);
  });

  it("assigns the correct number of words per team", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    const team0Words = board.filter((card) => card.team === 0);
    const team1Words = board.filter((card) => card.team === 1);

    expect(team0Words).toHaveLength(8);
    expect(team1Words).toHaveLength(8);
  });

  it("remaining words are neutral", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    const teamWords = board.filter((card) => card.team !== undefined).length;
    const assassinWords = board.filter((card) => card.isAssassin).length;
    const neutralWords = board.length - teamWords - assassinWords;

    // 25 total - 16 team words - 1 assassin = 8 neutral
    expect(neutralWords).toBe(8);
  });

  it("all words on the board are unique", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    const words = board.map((card) => card.word);
    expect(new Set(words).size).toBe(25);
  });

  it("no cards start as revealed", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    const revealedCards = board.filter((card) => card.revealed !== undefined);
    expect(revealedCards).toHaveLength(0);
  });

  it("throws when not enough words are provided", () => {
    const fewWords = ["a", "b", "c"];

    expect(() => shuffleBoard(defaultParameters, fewWords)).toThrow(
      "Not enough words to create a board"
    );
  });

  it("works with 3 teams", () => {
    const params = { ...defaultParameters, teamCount: 3, wordsToGuessCount: 6 };
    const board = shuffleBoard(params, classicWordList);

    expect(board).toHaveLength(25);

    const team0 = board.filter((card) => card.team === 0);
    const team1 = board.filter((card) => card.team === 1);
    const team2 = board.filter((card) => card.team === 2);

    expect(team0).toHaveLength(6);
    expect(team1).toHaveLength(6);
    expect(team2).toHaveLength(6);
  });
});
