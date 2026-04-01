import { getSpymasterTitle } from "../Game/spymasterTitle";

export type CardState = {
  word: string;
  team?: "player" | "opponent";
  isAssassin?: boolean;
  revealed?: boolean;
};

export type TutorialStep = {
  speaker: { emoji: string; name: string };
  message: string;
  board: CardState[];
  expectedTap?: string;
  highlightWords?: string[];
  autoAdvance?: boolean;
};

const baseBoard: CardState[] = [
  { word: "APPLE", team: "player" },
  { word: "ROCKET" },
  { word: "CLOUD", team: "opponent" },
  { word: "CHERRY", team: "player" },
  { word: "PIANO" },
  { word: "SHADOW", isAssassin: true },
  { word: "RIVER", team: "opponent" },
  { word: "CASTLE", team: "player" },
  { word: "FROST" },
];

// Randomize the animal characters each time
const playerAnimals = [
  { emoji: "🐱", name: "Cat" },
  { emoji: "🐰", name: "Bunny" },
  { emoji: "🦊", name: "Fox" },
  { emoji: "🐼", name: "Panda" },
  { emoji: "🐨", name: "Koala" },
  { emoji: "🦝", name: "Raccoon" },
];

const teammateAnimals = [
  { emoji: "🐶", name: "Dog" },
  { emoji: "🐻", name: "Bear" },
  { emoji: "🦦", name: "Otter" },
  { emoji: "🐧", name: "Penguin" },
  { emoji: "🦎", name: "Gecko" },
  { emoji: "🐸", name: "Frog" },
];

const leaderAnimals = [
  { emoji: "🦉", name: "Owl" },
  { emoji: "🦅", name: "Eagle" },
  { emoji: "🐬", name: "Dolphin" },
  { emoji: "🦒", name: "Giraffe" },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const player = pick(playerAnimals);
const teammate = pick(teammateAnimals);
const leader = pick(leaderAnimals);
const title = getSpymasterTitle();

export const tutorialCharacters = { player, teammate, leader };

export const tutorialSteps: TutorialStep[] = [
  {
    speaker: { emoji: leader.emoji, name: `${title} ${leader.name}` },
    message:
      `Welcome, Agent ${player.name}! ${player.emoji} You and ${teammate.name} ${teammate.emoji} are operatives — your job is to guess which words belong to your team. I'm your ${title}, and I can see them all!`,
    board: baseBoard,
    autoAdvance: true,
  },
  {
    speaker: { emoji: leader.emoji, name: `${title} ${leader.name}` },
    message:
      'My hint is "Fruit, 2" — that means TWO words on the board relate to fruit. Can you find them? Tap APPLE!',
    board: baseBoard,
    highlightWords: ["APPLE", "CHERRY"],
    expectedTap: "APPLE",
  },
  {
    speaker: { emoji: teammate.emoji, name: `Teammate ${teammate.name}` },
    message:
      "Great pick! 🎉 One more fruit word to find! Tap CHERRY!",
    board: baseBoard.map((c) =>
      c.word === "APPLE" ? { ...c, revealed: true } : c
    ),
    highlightWords: ["CHERRY"],
    expectedTap: "CHERRY",
  },
  {
    speaker: { emoji: leader.emoji, name: `${title} ${leader.name}` },
    message:
      `Amazing teamwork! 🎊 Now my next hint: "Water, 1". But be careful — tapping the wrong word ends your turn! Try tapping RIVER.`,
    board: baseBoard.map((c) =>
      c.word === "APPLE" || c.word === "CHERRY" ? { ...c, revealed: true } : c
    ),
    expectedTap: "RIVER",
  },
  {
    speaker: { emoji: teammate.emoji, name: `Teammate ${teammate.name}` },
    message:
      "Oh no! 😰 RIVER belongs to the other team! Our turn is over now. That's okay — wrong guesses happen!",
    board: baseBoard.map((c) =>
      ["APPLE", "CHERRY", "RIVER"].includes(c.word)
        ? { ...c, revealed: true }
        : c
    ),
    autoAdvance: true,
  },
  {
    speaker: { emoji: leader.emoji, name: `${title} ${leader.name}` },
    message:
      "See SHADOW? That's the assassin card! ☠️ If your team ever taps it, it's an instant game over. Always avoid it!",
    board: baseBoard.map((c) =>
      ["APPLE", "CHERRY", "RIVER"].includes(c.word)
        ? { ...c, revealed: true }
        : c.word === "SHADOW"
          ? { ...c, revealed: true }
          : c
    ),
    autoAdvance: true,
  },
  {
    speaker: { emoji: leader.emoji, name: `${title} ${leader.name}` },
    message:
      `You're ready, Agent ${player.name}! 🎊 The real game has a 5x5 board and a timer, but the rules are the same. Go find those codenam.es!`,
    board: baseBoard.map((c) => ({ ...c, revealed: true })),
    autoAdvance: true,
  },
];
