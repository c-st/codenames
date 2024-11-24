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
    <div className="flex items-center px-2 py-1 gap-1.5 bg-gray-100 dark:bg-gray-900 rounded-lg shadow-md">
      <p className="font-mono font-bold">{sessionName}</p>
      {isConnected && (
        <div className="text-l md:text-xl mt-1">
          <span className="animate-ping absolute opacity-50">⚡️</span>
          <span className="">⚡️</span>
        </div>
      )}
    </div>
  );
}
