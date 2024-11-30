import { GameState, Hint, Player, WordCard } from "../../schema/src/game";
import { setupBoard } from "./setup-board";
import { advanceDateBySeconds } from "./date";
import { GameError } from "./error";

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

  public joinGame(player: Pick<Player, "id" | "name">): GameState {
    // player gets randomly assigned to a team and a spymaster role
    const { teamCount } = this.parameters;
    const teams = Array.from({ length: teamCount }, (_, i) => i);

    // assign player to the team with the fewest players
    const team = teams.reduce((min, team) => {
      const teamPlayerCount = this.gameState.players.filter(
        (player) => player.team === team
      ).length;
      const minPlayerCount = this.gameState.players.filter(
        (player) => player.team === min
      ).length;
      return teamPlayerCount < minPlayerCount ? team : min;
    }, 0);

    const teamHasSpymaster = this.gameState.players.some(
      (player) => player.team === team && player.role === "spymaster"
    );

    return this.addOrUpdatePlayer({
      ...player,
      team,
      role: teamHasSpymaster ? "operative" : "spymaster",
    });
  }

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

    // TODO: end game when all players have left
    return this.gameState;
  }

  public startGame(): GameState {
    if (!this.isReadyToStartGame()) {
      throw new GameError(
        "Each team needs at least one spymaster and one operative"
      );
    }

    this.gameState.board = setupBoard(this.parameters, this.words);
    this.gameState.turn = {
      team: 0, // first team starts
      until: advanceDateBySeconds(
        new Date(),
        this.parameters.turnDurationSeconds
      ),
    };
    this.onScheduleCallAdvanceTurn(this.gameState.turn.until);
    return this.gameState;
  }

  public advanceTurn(): GameState {
    const { teamCount } = this.parameters;
    if (!this.gameState.turn) {
      throw new GameError("Game has not started yet");
    }

    const gameResult = this.getGameResult();
    if (gameResult) {
      throw new GameError("Game is already over");
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

  public giveHint(hint: Hint): GameState {
    if (!this.gameState.turn) {
      throw new GameError("Game has not started yet");
    }

    this.gameState.turn = {
      ...this.gameState.turn,
      hint,
    };

    return this.gameState;
  }

  public revealWord(word: string): GameState {
    const wordCard = this.gameState.board.find((card) => card.word === word);
    if (!wordCard) {
      throw new GameError("Word not found on board");
    }

    wordCard.isRevealed = true;
    this.updateCard(wordCard);

    const isWrongGuess = wordCard.team !== this.gameState.turn?.team;
    if (isWrongGuess || wordCard.isAssassin) {
      this.advanceTurn();
    }

    return this.gameState;
  }

  public getGameResult():
    | { winningTeam?: number; losingTeam?: number }
    | undefined {
    const { teamCount } = this.parameters;
    const isAssassinRevealed = this.gameState.board.some(
      (card) => card.isAssassin && card.isRevealed
    );

    const losingTeam = isAssassinRevealed
      ? this.gameState.turn?.team
      : undefined;

    const remainingWordsByTeam = this.gameState.board.reduce(
      (teams, word) => {
        if (word.team !== undefined && !word.isRevealed) {
          const currentCount = teams.get(word.team) ?? 0;
          teams.set(word.team, currentCount + 1);
        }
        return teams;
      },
      new Map<number, number>(
        Array.from({ length: teamCount }, (_, i) => [i, 0])
      )
    );

    const winningTeam = (
      remainingWordsByTeam.entries().find(([_, count]) => {
        return count === 0;
      }) || []
    ).at(0);

    if (winningTeam === undefined && losingTeam === undefined) {
      // game is not over
      return undefined;
    }

    return { winningTeam, losingTeam };
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public isReadyToStartGame(): boolean {
    const { teamCount } = this.parameters;
    const allTeams = Array.from({ length: teamCount });

    const allTeamsHaveSpymaster = allTeams.every((_, team) => {
      return this.gameState.players.some(
        (player) => player.team === team && player.role === "spymaster"
      );
    });

    const allTeamsHaveOperative = allTeams.every((_, team) => {
      return this.gameState.players.some(
        (player) => player.team === team && player.role === "operative"
      );
    });

    return allTeamsHaveSpymaster && allTeamsHaveOperative;
  }

  private updatePlayer(player: Player): GameState {
    this.gameState.players = this.gameState.players.map((p) =>
      p.id === player.id ? player : p
    );
    return this.gameState;
  }

  private updateCard(card: WordCard): GameState {
    this.gameState.board = this.gameState.board.map((c) =>
      c.word === card.word ? card : c
    );
    return this.gameState;
  }
}
