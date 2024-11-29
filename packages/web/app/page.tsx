"use client";

import SessionStatus from "@/components/SessionStatus";
import Logo from "@/components/ui/Logo";
import useCodenames from "@/components/hooks/useCodenames";
import Lobby from "@/components/Lobby";
import Board from "@/components/Board";
import DebugGame from "@/components/DebugGame";

export default function Home() {
  const {
    sessionName,
    isConnected,
    resetGame,
    closeConnection,
    promoteToSpymaster,
    setName,
    players,
    turn,
    board,
    currentPlayerId,
    gameCanBeStarted,
    startGame,
  } = useCodenames();

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center px-5 pt-5 min-h-screen sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="row-start-1 flex items-center justify-between gap-4 w-full">
        <Logo />
        <div className="">
          <SessionStatus isConnected={isConnected} sessionName={sessionName} />
        </div>
      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        {turn === undefined ? (
          <Lobby
            players={players}
            currentPlayerId={currentPlayerId}
            promoteToSpymaster={promoteToSpymaster}
            setName={setName}
            gameCanBeStarted={gameCanBeStarted}
            startGame={startGame}
          />
        ) : (
          <Board words={board} turn={turn} />
        )}
      </main>
      <footer className="row-start-3 flex justify-center"></footer>
      <DebugGame resetGame={resetGame} closeConnection={closeConnection} />
    </div>
  );
}
