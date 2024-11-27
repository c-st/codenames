"use client";

import CopyClipboardButton from "./ui/CopyClipboardButton";

type SessionStatusProps = {
  isConnected: boolean;
  sessionName: string | undefined;
};

export default function SessionStatus({
  isConnected,
  sessionName,
}: SessionStatusProps) {
  return (
    <div className="flex items-center px-1.5 pl-3 py-1 gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg shadow-md">
      {isConnected && (
        <div className="text-l md:text-xl mt-1.5">
          <span className="animate-ping absolute opacity-50">⚡️</span>
          <span className="">⚡️</span>
        </div>
      )}
      <p className="font-mono font-bold">{sessionName}</p>
      <CopyClipboardButton
        onClick={() =>
          navigator.clipboard.writeText(
            `https://codenam.es/?session=${sessionName}`
          )
        }
      />
    </div>
  );
}
