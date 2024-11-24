"use client";

type SessionStatusProps = {
  isConnected: boolean;
  sessionName: string | undefined;
};

export default function SessionStatus({
  isConnected,
  sessionName,
}: SessionStatusProps) {
  return (
    <span className="flex items-center">
      {isConnected && (
        <div className="text-xl mt-1">
          <span className="animate-ping absolute">⚡️</span>
          <span className="">⚡️</span>
        </div>
      )}
      <p className="font-mono font-bold">{sessionName}</p>
    </span>
  );
}
