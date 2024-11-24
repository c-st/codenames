"use client";

import HelloWord from "@/components/HelloWord";
import DebugGame from "@/components/DebugGame";
import SessionStatus from "@/components/SessionStatus";
import useCodenamesSession from "@/components/useCodenamesSession";
import { isInDevMode } from "@/isInDevMode";
import Logo from "@/components/Logo";

export default function Home() {
  const {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
  } = useCodenamesSession(
    isInDevMode ? "ws://localhost:8787" : "wss://api.codenam.es"
  );

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 px-4 py-4 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="row-start-1 flex items-center justify-between gap-4 w-full">
        <Logo />
        <div className="">
          <SessionStatus isConnected={isConnected} sessionName={sessionName} />
        </div>
      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <HelloWord />
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <span className="text-2xl"></span>
        <DebugGame
          incomingMessage={incomingMessage}
          sendMessage={sendMessage}
          closeConnection={closeConnection}
        />
      </footer>
    </div>
  );
}
