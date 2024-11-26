"use client";

type DebugGameProps = {
  incomingMessage: string | undefined;
  resetGame: () => void;
  hello: () => void;
  closeConnection: () => void;
};

export default function DebugGame({
  incomingMessage,
  resetGame,
  hello,
  closeConnection,
}: DebugGameProps) {
  const lastMessage = JSON.parse(incomingMessage || "{}");

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="">
          <pre className="font-mono text-xs">
            {JSON.stringify(lastMessage, null, 2)}
          </pre>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="bg-purple-500 hover:bg-purple-700 font-bold py-2 px-2 rounded"
            onClick={() => hello()}
          >
            ⬆ Hello
          </button>
          <button
            className="bg-red-500 hover:bg-red-700 font-bold py-2 px-2 rounded"
            onClick={() => resetGame()}
          >
            💀 Reset
          </button>
          <button
            className="bg-red-500 hover:bg-red-700 font-bold py-2 px-4 rounded"
            onClick={() => closeConnection()}
          >
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
}
