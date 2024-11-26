"use client";

import DebugGame from "@/components/DebugGame";
import SessionStatus from "@/components/SessionStatus";
import Logo from "@/components/Logo";
import useCodenames from "@/components/hooks/useCodenames";

export default function Home() {
  const {
    sessionName,
    isConnected,
    incomingMessage,
    closeConnection,
    resetGame,
    hello,
  } = useCodenames();

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 px-4 py-4 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="row-start-1 flex items-center justify-between gap-4 w-full">
        <Logo />
        <div className="">
          <SessionStatus isConnected={isConnected} sessionName={sessionName} />
        </div>
      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <DebugGame
          incomingMessage={incomingMessage}
          resetGame={resetGame}
          hello={hello}
          closeConnection={closeConnection}
        />
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <span className="text-2xl"></span>
      </footer>
    </div>
  );
}
