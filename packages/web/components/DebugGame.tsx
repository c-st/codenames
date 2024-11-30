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
        <div className="flex justify-end gap-2">
          <button
            className="rounded bg-red-500 px-2 py-2 font-bold hover:bg-red-700"
            onClick={() => resetGame()}
          >
            💀 Reset
          </button>
          <button
            className="rounded bg-red-500 px-4 py-2 font-bold hover:bg-red-700"
            onClick={() => closeConnection()}
          >
            Disconnect
          </button>
        </div>
      </div>
    </>
  );
}
