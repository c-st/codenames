import { GameState } from "./schema";

const exampleGameState: GameState = {
  id: "game-123",
  players: [
    { id: "player-1", name: "Alice", team: "red", role: "spymaster" },
    { id: "player-2", name: "Bob", team: "red", role: "operative" },
    { id: "player-3", name: "Charlie", team: "blue", role: "spymaster" },
    { id: "player-4", name: "Dana", team: "blue", role: "operative" },
  ],
  board: [
    { word: "apple", type: "red", revealed: false },
    { word: "banana", type: "blue", revealed: false },
    { word: "car", type: "neutral", revealed: false },
    { word: "bomb", type: "assassin", revealed: false },
  ],
  turn: "red",
  hint: { word: "fruit", count: 2 },
  status: "in-progress",
  winner: undefined,
};

export class Codenames {
  constructor() {}

  // update game settings

  // add player, set player name/team/role

  // start a game

  // set a hint

  // reveal a word
}
