"use client";

import { Message } from "schema";

type DebugGameProps = {
  incomingMessage: string | undefined;
  sendMessage: (message: string) => void;
  closeConnection: () => void;
};

const buildAddPlayerMessage = (): Message => {
  return {
    id: "1",
    timestamp: new Date().toISOString(),
    type: {
      type: "addPlayer",
      player: {
        id: "1",
        name: "Alice",
        role: "operative",
        team: 1,
      },
    },
  };
};

export default function DebugGame({
  sendMessage,
  closeConnection,
  incomingMessage,
}: DebugGameProps) {
  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="">
          <p className="font-mono text-l">{incomingMessage}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="bg-purple-500 hover:bg-purple-700 font-bold py-2 px-2 rounded"
            onClick={() => sendMessage(JSON.stringify(buildAddPlayerMessage()))}
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
      </div>
    </>
  );
}
