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

const getApiUrl = () => {
  // Use environment variable if set, otherwise fallback to defaults
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Default to localhost in development, production URL otherwise
  return process.env.NODE_ENV === "development"
    ? "ws://localhost:8787"
    : "wss://api.codenam.es";
};

const useCodenames = () => {
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
  } = useGameSession(getApiUrl());

  useEffect(() => {
    if (!incomingMessage) {
      return;
    }
    // Parse and validate incoming message
    const parseResult = gameEventSchema.safeParse(JSON.parse(incomingMessage));
    if (!parseResult.success) {
      // Invalid message format, ignore
      return;
    }
    if (parseResult.data.type === "commandRejected") {
      // Command was rejected by server, could show user feedback in the future
      return;
    }
    if (parseResult.data.type !== "gameStateUpdated") {
      // Unexpected message type, ignore
      return;
    }

    const gameState = parseResult.data.gameState;
    setGameState(gameState);
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
  }, [incomingMessage]);

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
    startGame: () => sendCommand({ type: "startGame" }),
    giveHint: (hint: string, count: number) =>
      sendCommand({ type: "giveHint", hint, count }),
    revealWord: (word: string) => sendCommand({ type: "revealWord", word }),
    endTurn: () => sendCommand({ type: "endTurn" }),
    endGame: () => sendCommand({ type: "endGame" }),
  };
};

export default useCodenames;
