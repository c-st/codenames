import { GameState, Hint, Player, WordCard } from "schema";
import { shuffleBoard } from "./shuffle-board";
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

export const initialGameState: GameState = {
  board: [],
  players: [],
  turn: undefined,
  hintHistory: [],
};

export class Codenames {
  constructor(
    private gameState: GameState = { board: [], players: [], hintHistory: [] },
    private words: string[],
    private onScheduleCallAdvanceTurn: (date: Date) => void,
    private parameters: GameParameters = defaultParameters,
  ) {}

  public setWords(words: string[]): void {
    this.words = words;
  }

  public setTeamCount(teamCount: number): void {
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 4) {
      throw new GameError("Team count must be between 2 and 4");
    }
    if (this.gameState.turn) {
      throw new GameError("End the game before changing teams");
    }
    if (teamCount === this.parameters.teamCount) return;
    this.parameters = { ...this.parameters, teamCount };
    this.shuffleTeams();
  }

  public shuffleTeams(): GameState {
    if (this.gameState.turn) {
      throw new GameError("End the game before shuffling teams");
    }
    const players = [...this.gameState.players];
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    this.gameState.players = players.map((player, index) => ({
      ...player,
      team: index % this.parameters.teamCount,
      role: index < this.parameters.teamCount ? "spymaster" : "operative",
    }));
    return this.gameState;
  }

  public joinGame(player: Pick<Player, "id" | "name">): GameState {
    const existingPlayer = this.gameState.players.find(
      (p) => p.id === player.id,
    );
    if (existingPlayer) {
      return this.addOrUpdatePlayer({ ...existingPlayer, ...player });
    }
    // Assign new arrivals to the smallest team.
    const { teamCount } = this.parameters;
    const teams = Array.from({ length: teamCount }, (_, i) => i);

    // assign player to the team with the fewest players
    const team = teams.reduce((min, team) => {
      const teamPlayerCount = this.gameState.players.filter(
        (player) => player.team === team,
      ).length;
      const minPlayerCount = this.gameState.players.filter(
        (player) => player.team === min,
      ).length;
      return teamPlayerCount < minPlayerCount ? team : min;
    }, 0);

    const teamHasSpymaster = this.gameState.players.some(
      (player) => player.team === team && player.role === "spymaster",
    );

    return this.addOrUpdatePlayer({
      ...player,
      team,
      role: teamHasSpymaster ? "operative" : "spymaster",
    });
  }

  public addOrUpdatePlayer(player: Player): GameState {
    if (
      !Number.isInteger(player.team) ||
      player.team < 0 ||
      player.team >= this.parameters.teamCount
    ) {
      throw new GameError("Player team is invalid");
    }
    const previousPlayer = this.gameState.players.find(
      (p) => p.id === player.id,
    );
    // Updating a profile must not run leave-game side effects.
    const remainingPlayers = this.gameState.players.filter(
      (p) => p.id !== player.id,
    );
    if (
      previousPlayer?.role === "spymaster" &&
      (player.team !== previousPlayer.team || player.role !== "spymaster")
    ) {
      const replacement = remainingPlayers.find(
        (p) => p.team === previousPlayer.team,
      );
      if (replacement) replacement.role = "spymaster";
    }
    if (player.role === "spymaster") {
      for (const teammate of remainingPlayers) {
        if (teammate.team === player.team && teammate.role === "spymaster") {
          teammate.role = "operative";
        }
      }
    }
    this.gameState.players = previousPlayer
      ? this.gameState.players.map((p) => (p.id === player.id ? player : p))
      : [...remainingPlayers, player];
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
          player.team === playerToRemove.team &&
          player.id !== playerToRemove.id,
      );
      if (newSpymaster) {
        newSpymaster.role = "spymaster";
        this.updatePlayer(newSpymaster);
      }
    }

    this.gameState.players = this.gameState.players.filter((p) => p.id !== id);

    // End game when all players have left
    if (this.gameState.players.length === 0 && this.gameState.turn) {
      this.endGame();
    }
    return this.gameState;
  }

  public startGame(): GameState {
    if (!this.isReadyToStartGame()) {
      throw new GameError(
        "Each team needs at least one spymaster and one operative",
      );
    }
    if (this.gameState.turn && !this.getGameResult()) {
      throw new GameError("Game is already in progress");
    }
    const startingTeam = Math.floor(Math.random() * this.parameters.teamCount);
    const board = shuffleBoard(this.parameters, this.words, startingTeam);
    this.gameState.hintHistory = [];
    this.gameState.board = board;
    this.gameState.turn = {
      team: startingTeam,
      until: advanceDateBySeconds(
        new Date(),
        this.parameters.turnDurationSeconds,
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
        this.parameters.turnDurationSeconds,
      ),
    };

    this.onScheduleCallAdvanceTurn(this.gameState.turn.until);

    return this.gameState;
  }

  public giveHint(hint: Hint): GameState {
    if (!this.gameState.turn) {
      throw new GameError("Game has not started yet");
    }
    if (this.getGameResult()) {
      throw new GameError("Game is already over");
    }
    if (this.gameState.turn.hint) {
      throw new GameError("A hint has already been given this turn");
    }
    if (
      !hint.hint.trim() ||
      !Number.isInteger(hint.count) ||
      hint.count < 0 ||
      hint.count > this.parameters.totalWordCount
    ) {
      throw new GameError("Hint must contain text and a valid count");
    }
    hint = { ...hint, hint: hint.hint.trim() };
    this.gameState.turn = {
      ...this.gameState.turn,
      hint,
      guessesRemaining: hint.count > 0 ? hint.count + 1 : undefined,
    };
    this.gameState.hintHistory.push({
      ...hint,
      team: this.gameState.turn.team,
      inTurn: this.gameState.hintHistory.length,
    });

    return this.gameState;
  }

  public revealWord(word: string): GameState {
    const wordCard = this.gameState.board.find((card) => card.word === word);
    if (!wordCard) {
      throw new GameError("Word not found on board");
    }

    if (!this.gameState.turn) {
      throw new GameError("Game has not started yet");
    }

    if (wordCard.revealed) {
      throw new GameError("Word already revealed");
    }

    if (this.getGameResult()) {
      throw new GameError("Game is already over");
    }
    if (!this.gameState.turn.hint) {
      throw new GameError("Cannot reveal words without a hint");
    }

    wordCard.revealed = {
      byTeam: this.gameState.turn.team,
      inTurn: this.gameState.hintHistory.length,
    };

    this.updateCard(wordCard);

    const gameResult = this.getGameResult();
    if (gameResult) {
      return this.gameState;
    }

    const isWrongGuess = wordCard.team !== this.gameState.turn?.team;
    if (isWrongGuess) {
      this.advanceTurn();
      return this.gameState;
    }

    // Decrement guesses remaining on correct guess
    if (this.gameState.turn?.guessesRemaining !== undefined) {
      this.gameState.turn.guessesRemaining--;
      if (this.gameState.turn.guessesRemaining <= 0) {
        this.advanceTurn();
      }
    }

    return this.gameState;
  }

  public getRemainingWordsByTeam(): Map<number, number> {
    const { teamCount } = this.parameters;
    const remainingWordsByTeam = this.gameState.board.reduce(
      (teams, word) => {
        if (word.team !== undefined && word.revealed === undefined) {
          const currentCount = teams.get(word.team) ?? 0;
          teams.set(word.team, currentCount + 1);
        }
        return teams;
      },
      new Map<number, number>(
        Array.from({ length: teamCount }, (_, i) => [i, 0]),
      ),
    );
    return remainingWordsByTeam;
  }

  public getGameResult():
    | { winningTeam?: number; losingTeam?: number }
    | undefined {
    // No result if the game hasn't started or board is empty
    if (this.gameState.board.length === 0) {
      return undefined;
    }

    const assassin = this.gameState.board.find(
      (card) => card.isAssassin && card.revealed !== undefined,
    );
    const losingTeam = assassin?.revealed?.byTeam;

    const remainingWordsByTeam = this.getRemainingWordsByTeam();

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

  /** True when the current clue's words were all found, with no wrong guess. */
  public isCurrentClueComplete(): boolean {
    const hint = this.gameState.hintHistory.at(-1);
    if (!hint || hint.count === 0) return false;
    const guesses = this.gameState.board.filter(
      (card) => card.revealed?.inTurn === this.gameState.hintHistory.length,
    );
    return (
      guesses.length === hint.count &&
      guesses.every((card) => card.team === hint.team)
    );
  }

  public getGameState(): GameState {
    return this.gameState;
  }

  public endGame(): GameState {
    this.gameState.turn = undefined;
    this.gameState.hintHistory = [];
    this.gameState.board = [];
    return this.gameState;
  }

  public isReadyToStartGame(): boolean {
    const { teamCount } = this.parameters;
    const allTeams = Array.from({ length: teamCount });

    const allTeamsHaveSpymaster = allTeams.every((_, team) => {
      return this.gameState.players.some(
        (player) => player.team === team && player.role === "spymaster",
      );
    });

    const allTeamsHaveOperative = allTeams.every((_, team) => {
      return this.gameState.players.some(
        (player) => player.team === team && player.role === "operative",
      );
    });

    return allTeamsHaveSpymaster && allTeamsHaveOperative;
  }

  private updatePlayer(player: Player): GameState {
    this.gameState.players = this.gameState.players.map((p) =>
      p.id === player.id ? player : p,
    );
    return this.gameState;
  }

  private updateCard(card: WordCard): GameState {
    this.gameState.board = this.gameState.board.map((c) =>
      c.word === card.word ? card : c,
    );
    return this.gameState;
  }
}
