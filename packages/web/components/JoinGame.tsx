"use client";

import useWebSocket from "./useWebsocket";

export default function JoinGame() {
  const {
    isConnected,
    resolvedUrl,
    incomingMessage,
    sendMessage,
    closeConnection,
  } = useWebSocket(
    "wss://api.codenam.es"
    // "ws://localhost:8787"
  );

  return (
    <>
      <span className="font-mono">
        {isConnected ? "⚡️" : ""} {resolvedUrl}
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
