"use client";

type DebugGameProps = {
  resetGame: () => void;
  closeConnection: () => void;
};

export default function DebugGame({
  resetGame,
  closeConnection,
}: DebugGameProps) {
  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          {/* <Toggle />
          <Toggle /> */}
        </div>
        <div className="flex gap-2 justify-end">
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
