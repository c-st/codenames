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
    { word: "apple", type: "team", forTeam: "red", revealed: false },
    { word: "banana", type: "team", forTeam: "blue", revealed: false },
    { word: "car", type: "neutral", revealed: false },
    { word: "bomb", type: "assassin", revealed: false },
  ],
  teams: ["red", "blue"],
  turn: {
    team: "red",
    until: new Date(),
    hint: {
      word: "fruit",
      count: 2,
    },
  },
};

export class Codenames {
  constructor() {}

  // update game settings

  // add player, set player name/team/role

  // start a game

  // set a hint

  // reveal a word
}
