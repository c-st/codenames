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

    expect(team0Words).toHaveLength(9);
    expect(team1Words).toHaveLength(8);
  });

  it("remaining words are neutral", () => {
    const board = shuffleBoard(defaultParameters, classicWordList);

    const teamWords = board.filter((card) => card.team !== undefined).length;
    const assassinWords = board.filter((card) => card.isAssassin).length;
    const neutralWords = board.length - teamWords - assassinWords;

    // 25 total - 17 team words - 1 assassin = 7 neutral
    expect(neutralWords).toBe(7);
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
      "Not enough words to create a board",
    );
  });

  it("works with 3 teams", () => {
    const params = { ...defaultParameters, teamCount: 3, wordsToGuessCount: 6 };
    const board = shuffleBoard(params, classicWordList);

    expect(board).toHaveLength(25);

    const team0 = board.filter((card) => card.team === 0);
    const team1 = board.filter((card) => card.team === 1);
    const team2 = board.filter((card) => card.team === 2);

    expect(team0).toHaveLength(7);
    expect(team1).toHaveLength(6);
    expect(team2).toHaveLength(6);
  });
});

it("gives the selected starting team its traditional extra word", () => {
  const board = shuffleBoard(defaultParameters, classicWordList, 1);
  expect(board.filter((card) => card.team === 0)).toHaveLength(8);
  expect(board.filter((card) => card.team === 1)).toHaveLength(9);
});

it("rejects lists with too few unique words rather than returning a truncated board", () => {
  expect(() =>
    shuffleBoard(defaultParameters, Array(25).fill("repeat")),
  ).toThrow("Not enough words");
});

it("supports four teams without exceeding the board capacity", () => {
  const board = shuffleBoard(
    { ...defaultParameters, teamCount: 4 },
    classicWordList,
    2,
  );
  expect(board).toHaveLength(25);
  for (let team = 0; team < 4; team++) {
    expect(board.filter((card) => card.team === team)).toHaveLength(
      team === 2 ? 6 : 5,
    );
  }
  expect(board.filter((card) => card.isAssassin)).toHaveLength(1);
});
