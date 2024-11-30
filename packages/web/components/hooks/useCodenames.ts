import {
  Command,
  GameStateForClient,
  gameStateSchemaForClient,
  Player,
  Turn,
  WordCard,
} from "schema";
import useGameSession from "./useGameSession";
import { useEffect, useState } from "react";

const useCodenames = () => {
  const [gameState, setGameState] = useState<GameStateForClient>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [board, setBoard] = useState<WordCard[]>();
  const [turn, setTurn] = useState<Turn>();

  const {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
  } = useGameSession(
    isInDevMode ? "ws://localhost:8787" : "wss://api.codenam.es",
  );

  useEffect(() => {
    if (!incomingMessage) {
      return;
    }
    const parseResult = gameStateSchemaForClient.safeParse(
      JSON.parse(incomingMessage),
    );
    if (!parseResult.success) {
      console.error("Failed to parse incoming message:", parseResult.error);
      return;
    }
    const newGameState = parseResult.data;
    console.log("Updating game state:", newGameState);
    setGameState(newGameState);
    const { players, board, turn } = newGameState;
    setPlayers(players);
    setBoard(board);
    setTurn(turn);
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
    board,
    gameCanBeStarted: gameState?.gameCanStart ?? false,
    currentPlayerId: gameState?.playerId ?? "",
    // Commands
    resetGame: () => sendCommand({ type: "resetGame" }),
    setName: (name: string) => sendCommand({ type: "setName", name }),
    promoteToSpymaster: (playerId: string) =>
      sendCommand({ type: "promoteToSpymaster", playerId }),
    startGame: () => sendCommand({ type: "startGame" }),
    giveHint: (hint: string, count: number) =>
      sendCommand({ type: "giveHint", hint, count }),
    revealWord: (word: string) => sendCommand({ type: "revealWord", word }),
  };
};

const isInDevMode = !!process && process.env.NODE_ENV === "development";

export default useCodenames;
