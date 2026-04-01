"use client";

import CopyClipboardButton from "../ui/CopyClipboardButton";

type SessionStatusProps = {
  isConnected: boolean;
  sessionName: string | undefined;
};

export default function SessionStatus({
  isConnected,
  sessionName,
}: SessionStatusProps) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-surface px-1.5 py-1 pl-3 shadow-md">
      {isConnected && (
        <div className="relative flex items-center text-base md:text-lg">
          <span className="absolute animate-ping opacity-40">⚡️</span>
          <span>⚡️</span>
        </div>
      )}
      <p className="select-none font-mono text-sm font-bold !text-white md:text-base">
        {sessionName}
      </p>
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
