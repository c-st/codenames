"use client";

import useCodenamesSession from "./useCodenamesSession";
import useWebSocket from "./useWebsocket";

export default function JoinGame() {
  const {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
  } = useCodenamesSession("ws://localhost:8787");

  return (
    <>
      <span className="font-mono">
        {isConnected ? "⚡️" : ""} {sessionName}
      </span>
      <div className="flex items-center justify-start gap-2">
        <button
          className="bg-purple-500 hover:bg-purple-700 font-bold py-2 px-2 rounded"
          onClick={() => sendMessage("hello")}
        >
          ⬆ hello
        </button>
        <button
          className="bg-green-500 hover:bg-green-700 font-bold py-2 px-4 rounded"
          onClick={() => closeConnection()}
        >
          ↻
        </button>
      </div>
      <p className="font-mono text-l">{incomingMessage}</p>
    </>
  );
}
