import { GameState, Hint } from "./schema";

const exampleGameState: GameState = {
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

type GameParameters = {
  turnTimeSeconds: number;
  wordList: string[];
  // teams: string[];
};

export class Codenames {
  private gameState: GameState;

  constructor() {
    this.gameState = {
      players: [],
      board: [],
      teams: [],
    };
  }

  public addPlayer(): GameState {
    // add player, set player name/team/role
    return this.gameState;
  }

  public removePlayer(id: string): GameState {
    // remove player, assign new spymaster if needed
    return this.gameState;
  }

  public startGame(settings: GameParameters): GameState {
    // shuffle words, start timer for first turn
    return this.gameState;
  }

  public advanceTurn(): GameState {
    // triggered by timer
    // advance turn to next team
    return this.gameState;
  }

  public setHint(hint: Hint): GameState {
    //
    return this.gameState;
  }

  public makeGuess(word: string): GameState {
    // return updated game state
    return this.gameState;
  }
}
