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
import { useEffect, useRef, useState } from "react";

const useCodenames = (skip: boolean = false) => {
  const [gameState, setGameState] = useState<GameStateForClient>();
  const [gameWon, setGameWon] = useState(false);
  const prevResultRef = useRef<GameResult | undefined>(undefined);
  const isFirstMessageRef = useRef(true);
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

    // Detect fresh win from server update (skip the first message — that's reconnect state)
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
    } else if (
      gameResult?.winningTeam !== undefined &&
      prevResultRef.current?.winningTeam === undefined
    ) {
      setGameWon(true);
    }
    if (!gameResult) {
      setGameWon(false);
    }
    prevResultRef.current = gameResult;
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
    gameWon,
    wordPack: (gameState?.wordPack ?? "classic") as "classic" | "movies" | "food" | "geography" | "science" | "tech" | "agile" | "design" | "startup" | "internet",
    teamCount: gameState?.teamCount ?? 2,
    // Commands
    setName: (name: string) => sendCommand({ type: "setName", name }),
    randomizeName: () => sendCommand({ type: "randomizeName" }),
    promoteToSpymaster: (playerId: string) =>
      sendCommand({ type: "promoteToSpymaster", playerId }),
    startGame: () => sendCommand({ type: "startGame" }),
    setWordPack: (wordPack: "classic" | "movies" | "food" | "geography" | "science" | "tech" | "agile" | "design" | "startup" | "internet") =>
      sendCommand({ type: "setWordPack", wordPack }),
    setTeamCount: (teamCount: number) =>
      sendCommand({ type: "setTeamCount", teamCount }),
    giveHint: (hint: string, count: number) =>
      sendCommand({ type: "giveHint", hint, count }),
    revealWord: (word: string) => sendCommand({ type: "revealWord", word }),
    endTurn: () => sendCommand({ type: "endTurn" }),
    endGame: () => {
      setGameWon(false);
      sendCommand({ type: "endGame" });
    },
  };
};

const isInDevMode = !!process && process.env.NODE_ENV === "development";

export default useCodenames;
