import { Command } from "schema";
import useGameSession from "./useGameSession";

const useCodenames = () => {
  const {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
  } = useGameSession(
    isInDevMode ? "ws://localhost:8787" : "wss://api.codenam.es"
  );

  const resetGame = () => {
    const message: Command = {
      type: "resetGame",
    };
    sendMessage(JSON.stringify(message));
  };

  const hello = () => {
    const message: Command = {
      type: "hello",
    };
    sendMessage(JSON.stringify(message));
  };

  return {
    // Connection
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
    // Gameplay
    resetGame,
    hello,
  };
};

const isInDevMode = !!process && process.env.NODE_ENV === "development";

export default useCodenames;
