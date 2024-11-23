import { GameState, Hint, Player, WordCard } from "./schema";
import { setupBoard } from "./setup-board";
import { advanceDateBySeconds } from "./date";

export type GameParameters = {
  turnDurationSeconds: number;
  totalWordCount: number;
  wordsToGuessCount: number;
  teamCount: number;
};

export const defaultParameters: GameParameters = {
  turnDurationSeconds: 120,
  totalWordCount: 5 * 5,
  wordsToGuessCount: 8,
  teamCount: 2,
};

const initialGameState: GameState = {
  board: [],
  players: [],
  turn: undefined,
};

export class Codenames {
  constructor(
    private gameState: GameState = initialGameState,
    private words: string[],
    private onScheduleCallAdvanceTurn: (date: Date) => void,
    private parameters: GameParameters = defaultParameters
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
    this.gameState.board = setupBoard(this.parameters, this.words);
    this.gameState.turn = {
      team: 0,
      until: advanceDateBySeconds(
        new Date(),
        this.parameters.turnDurationSeconds
      ),
    };
    this.onScheduleCallAdvanceTurn(this.gameState.turn.until);
    return this.gameState;
  }

  public advanceTurn(): GameState {
    // triggered by timer or by "end turn" command
    const { teamCount } = this.parameters;

    if (!this.gameState.turn) {
      throw new GameError("Game has not started yet");
    }

    const currentTeam = this.gameState.turn.team;
    const nextTeam = (currentTeam + 1) % teamCount;
    this.gameState.turn = {
      team: nextTeam,
      until: advanceDateBySeconds(
        new Date(),
        this.parameters.turnDurationSeconds
      ),
    };

    this.onScheduleCallAdvanceTurn(this.gameState.turn.until);

    return this.gameState;
  }

  public setHint(hint: Hint): GameState {
    if (!this.gameState.turn) {
      throw new GameError("Game has not started yet");
    }

    this.gameState.turn = {
      ...this.gameState.turn,
      hint,
    };

    return this.gameState;
  }

  public makeGuess(word: string): GameState {
    // ...
    return this.gameState;
  }

  private updatePlayer(player: Player) {
    this.gameState.players = this.gameState.players.map((p) =>
      p.id === player.id ? player : p
    );
    return this.gameState;
  }
}
