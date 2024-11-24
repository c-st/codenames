"use client";

import useCodenamesSession from "./useCodenamesSession";

type DebugGameProps = {
  incomingMessage: string | undefined;
  sendMessage: (message: string) => void;
  closeConnection: () => void;
};

export default function DebugGame({
  sendMessage,
  closeConnection,
  incomingMessage,
}: DebugGameProps) {
  return (
    <>
      <div className="flex items-center justify-start gap-2">
        <button
          className="bg-purple-500 hover:bg-purple-700 font-bold py-2 px-2 rounded"
          onClick={() => sendMessage("hello")}
        >
          ⬆ hello
        </button>
        <button
          className="bg-red-500 hover:bg-red-700 font-bold py-2 px-4 rounded"
          onClick={() => closeConnection()}
        >
          Close
        </button>
      </div>
      <p className="font-mono text-l">{incomingMessage}</p>
    </>
  );
}
