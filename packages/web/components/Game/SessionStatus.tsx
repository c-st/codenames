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
    <div className="glass-panel col-span-2 flex w-full min-w-0 max-w-full items-center gap-2 !rounded-2xl px-1.5 py-1 pl-3 md:w-auto md:max-w-[55vw]">
      <span
        role="status"
        aria-live="polite"
        className="text-xs text-purple-300"
      >
        {isConnected ? "Connected" : "Reconnecting…"}
      </span>
      <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
        {isConnected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50 motion-reduce:animate-none" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-amber-400"}`}
        />
      </span>
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
