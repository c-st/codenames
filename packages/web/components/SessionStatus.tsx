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
    <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-1.5 py-1 pl-3 shadow-md dark:bg-gray-900">
      {isConnected && (
        <div className="text-l mt-1.5 md:text-xl">
          <span className="absolute animate-ping opacity-50">⚡️</span>
          <span className="">⚡️</span>
        </div>
      )}
      <p className="font-mono text-sm font-bold md:text-base">{sessionName}</p>
      <CopyClipboardButton
        onClick={() =>
          navigator.clipboard.writeText(
            `https://codenam.es/?session=${sessionName}`,
          )
        }
      />
    </div>
  );
}
