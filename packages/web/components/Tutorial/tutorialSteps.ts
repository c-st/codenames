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

export const tutorialSteps: TutorialStep[] = [
  {
    speaker: { emoji: "🦉", name: "Spymaster Owl" },
    message:
      "Welcome, Agent Cat! 🐱 You and Dog 🐶 are operatives — your job is to guess which words belong to your team. I'm your Spymaster, and I can see them all!",
    board: baseBoard,
    autoAdvance: true,
  },
  {
    speaker: { emoji: "🦉", name: "Spymaster Owl" },
    message:
      'My hint is "Fruit, 2" — that means TWO words on the board relate to fruit. Can you find them? Tap APPLE!',
    board: baseBoard,
    highlightWords: ["APPLE", "CHERRY"],
    expectedTap: "APPLE",
  },
  {
    speaker: { emoji: "🐶", name: "Teammate Dog" },
    message:
      "Great pick! 🎉 One more fruit word to find! Tap CHERRY!",
    board: baseBoard.map((c) =>
      c.word === "APPLE" ? { ...c, revealed: true } : c
    ),
    highlightWords: ["CHERRY"],
    expectedTap: "CHERRY",
  },
  {
    speaker: { emoji: "🦉", name: "Spymaster Owl" },
    message:
      'Amazing teamwork! 🎊 Now my next hint: "Water, 1". But be careful — tapping the wrong word ends your turn! Try tapping RIVER.',
    board: baseBoard.map((c) =>
      c.word === "APPLE" || c.word === "CHERRY" ? { ...c, revealed: true } : c
    ),
    expectedTap: "RIVER",
  },
  {
    speaker: { emoji: "🐶", name: "Teammate Dog" },
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
    speaker: { emoji: "🦉", name: "Spymaster Owl" },
    message:
      "See SHADOW? That's the assassin card! ☠️ If you ever tap it, your team INSTANTLY loses. Always avoid it!",
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
    speaker: { emoji: "🦉", name: "Spymaster Owl" },
    message:
      "You're ready, Agent Cat! 🎊 The real game has a 5x5 board and a timer, but the rules are the same. Go find those codenam.es!",
    board: baseBoard.map((c) => ({ ...c, revealed: true })),
    autoAdvance: true,
  },
];
