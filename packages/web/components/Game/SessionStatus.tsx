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
    <div className="col-span-2 flex w-full min-w-0 max-w-full items-center md:w-auto md:max-w-[55vw] gap-2 rounded-2xl bg-surface px-1.5 py-1 pl-3 shadow-md">
      <span
        role="status"
        aria-live="polite"
        className="text-xs text-purple-300"
      >
        {isConnected ? "Connected" : "Reconnecting…"}
      </span>
      {isConnected && (
        <div className="relative flex items-center text-base md:text-lg">
          <span className="absolute animate-ping opacity-40">⚡️</span>
          <span>⚡️</span>
        </div>
      )}
      <p
        title={sessionName}
        className="min-w-0 truncate select-none font-mono text-sm font-bold !text-white md:text-base"
      >
        {sessionName}
      </p>
      <CopyClipboardButton
        onClick={() =>
          navigator.clipboard.writeText(
            `${window.location.origin}/?session=${encodeURIComponent(sessionName ?? "")}`,
          )
        }
      />
    </div>
  );
}
