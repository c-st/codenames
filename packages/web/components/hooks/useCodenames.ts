import {
  Command,
  gameEventSchema,
  GameResult,
  GameStateForClient,
  HintHistory,
  Player,
  Turn,
  WordCard,
} from "schema";
import useGameSession from "./useGameSession";
import { useEffect, useState } from "react";

const useCodenames = (skip: boolean = false) => {
  const [gameState, setGameState] = useState<GameStateForClient>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [board, setBoard] = useState<WordCard[]>();
  const [turn, setTurn] = useState<Turn>();
  const [hintHistory, setHintHistory] = useState<HintHistory>([]);
  const [gameResult, setGameResult] = useState<GameResult>();
  const [remainingWordsByTeam, setRemainingWordsByTeam] = useState<number[]>(
    [],
  );

  const {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
    onPlayerIdReceived,
  } = useGameSession(
    isInDevMode ? "ws://localhost:8787" : "wss://api.codenam.es",
    skip,
  );

  useEffect(() => {
    if (!incomingMessage) {
      return;
    }
    // check for gameState or commandStatus
    let parsed;
    try {
      parsed = JSON.parse(incomingMessage);
    } catch {
      console.error("Failed to parse incoming message as JSON:", incomingMessage);
      return;
    }
    const parseResult = gameEventSchema.safeParse(parsed);
    if (!parseResult.success) {
      console.error("Failed to parse incoming message:", parseResult.error);
      return;
    }
    if (parseResult.data.type === "commandRejected") {
      console.warn("Command rejected:", parseResult.data.reason);
      return;
    }
    if (parseResult.data.type !== "gameStateUpdated") {
      console.error("Unexpected message type:", parseResult);
      return;
    }

    const gameState = parseResult.data.gameState;
    setGameState(gameState);
    onPlayerIdReceived(gameState.playerId);
    const {
      players,
      board,
      turn,
      hintHistory,
      remainingWordsByTeam,
      gameResult,
    } = gameState;
    setPlayers(players);
    setBoard(board);
    setTurn(turn);
    setHintHistory(hintHistory);
    setRemainingWordsByTeam(remainingWordsByTeam);
    setGameResult(gameResult);
    if (gameResult && turn) {
      console.info("Game has ended", {
        players,
        board,
        turn,
        hintHistory,
        gameResult,
      });
    }
  }, [incomingMessage, onPlayerIdReceived]);

  const sendCommand = (command: Command) =>
    sendMessage(JSON.stringify(command));

  return {
    // Connection
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
    // Gameplay
    players,
    turn,
    hintHistory,
    board,
    remainingWordsByTeam,
    gameResult,
    gameCanBeStarted: gameState?.gameCanStart ?? false,
    currentPlayerId: gameState?.playerId ?? "",
    // Commands
    setName: (name: string) => sendCommand({ type: "setName", name }),
    promoteToSpymaster: (playerId: string) =>
      sendCommand({ type: "promoteToSpymaster", playerId }),
    startGame: (options?: { wordPack?: "classic" | "movies" | "food" | "geography" | "science"; teamCount?: number }) =>
      sendCommand({ type: "startGame", ...options }),
    giveHint: (hint: string, count: number) =>
      sendCommand({ type: "giveHint", hint, count }),
    revealWord: (word: string) => sendCommand({ type: "revealWord", word }),
    endTurn: () => sendCommand({ type: "endTurn" }),
    endGame: () => sendCommand({ type: "endGame" }),
  };
};

const isInDevMode = !!process && process.env.NODE_ENV === "development";

export default useCodenames;
