import { GameState, Hint, Player } from "./schema";

const initialGameState: GameState = {
  players: [],
  board: [],
  teams: [],
  turn: undefined,
};

const defaultParameters: GameParameters = {
  turnTimeSeconds: 120,
  wordCount: 5 * 5,
  teamCount: 2,
};

type GameParameters = {
  turnTimeSeconds: number;
  wordCount: number;
  teamCount: number;
};

export class Codenames {
  private defaultParameters: GameParameters = {
    turnTimeSeconds: 120,
    wordCount: 5 * 5,
    teamCount: 2,
  };

  constructor(
    private gameState: GameState = initialGameState,
    private words: string[] = [],
    private parameters: GameParameters = this.defaultParameters
  ) {}

  public addOrUpdatePlayer(player: Player): GameState {
    if (this.gameState.players.some((p) => p.id === player.id)) {
      this.removePlayer(player.id);
    }
    if (player.role === "spymaster") {
      const spymaster = this.gameState.players.find(
        (p) => p.team === player.team && p.role === "spymaster"
      );
      if (spymaster) {
        spymaster.role = "operative";
        this.updatePlayer(spymaster);
      }
    }
    this.gameState.players.push(player);
    return this.gameState;
  }

  public removePlayer(id: string): GameState {
    const playerToRemove = this.gameState.players.find((p) => p.id === id);
    if (!playerToRemove) {
      return this.gameState;
    }

    // reassign spymaster role:
    if (playerToRemove.role === "spymaster") {
      const newSpymaster = this.gameState.players.find(
        (player) =>
          player.team === playerToRemove.team && player.id !== playerToRemove.id
      );
      if (newSpymaster) {
        newSpymaster.role = "spymaster";
        this.updatePlayer(newSpymaster);
      }
    }

    this.gameState.players = this.gameState.players.filter((p) => p.id !== id);
    return this.gameState;
  }

  public startGame(): GameState {
    const shuffledWords = this.words
      .sort(() => Math.random() - 0.5)
      .slice(0, this.parameters.wordCount);

    console.log(shuffledWords);

    //, start timer for first turn
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

  private updatePlayer(player: Player) {
    this.gameState.players = this.gameState.players.map((p) =>
      p.id === player.id ? player : p
    );
    return this.gameState;
  }
}
