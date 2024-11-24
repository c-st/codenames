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
    <span className="font-mono font-bold">
      {isConnected ? "⚡️" : ""} {sessionName}
    </span>
  );
}
