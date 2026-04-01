"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import useCodenames from "@/components/hooks/useCodenames";
import Lobby from "@/components/Game/Lobby/Lobby";
import GameControls from "@/components/Game/GameControls";
import Board from "@/components/Game/Board/Board";
import SessionStatus from "@/components/Game/SessionStatus";
import SplashScreen from "@/components/SplashScreen";
import Tutorial from "@/components/Tutorial/Tutorial";

export default function Home() {
  const searchParams = useSearchParams();
  const hasSession = !!searchParams?.get("session");
  const [showTutorial, setShowTutorial] = useState(false);
  const [wantsToPlay, setWantsToPlay] = useState(false);

  // Skip connection until user clicks Play (or has a session URL)
  const skipConnection = !hasSession && !wantsToPlay;

  const {
    sessionName,
    isConnected,
    promoteToSpymaster,
    setName,
    players,
    turn,
    hintHistory,
    board,
    remainingWordsByTeam,
    gameResult,
    currentPlayerId,
    gameCanBeStarted,
    startGame,
    revealWord,
    endTurn,
    endGame,
    giveHint,
  } = useCodenames(skipConnection);

  // Show tutorial if requested
  if (showTutorial) {
    return <Tutorial onComplete={() => setShowTutorial(false)} />;
  }

  // Show splash screen if not connecting yet
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) {
    if (skipConnection) {
      return (
        <SplashScreen
          onPlay={() => setWantsToPlay(true)}
          onLearnToPlay={() => setShowTutorial(true)}
        />
      );
    }
    return null;
  }

  const gameIsRunning = turn !== undefined;

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] justify-items-center p-2 font-[family-name:var(--font-geist-sans)] md:p-8 lg:p-20 lg:pt-8">
      <header className="row-start-1 flex w-full items-center justify-between">
        <Logo />
        <div className="">
          <SessionStatus isConnected={isConnected} sessionName={sessionName} />
        </div>
      </header>
      <main className="row-start-2 mb-2 flex flex-col gap-8 pt-8 sm:items-start">
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
          <Board
            isConnected={isConnected}
            players={players}
            currentPlayerId={currentPlayerId}
            words={board}
            turn={turn}
            hintHistory={hintHistory}
            remainingWordsByTeam={remainingWordsByTeam}
            gameResult={gameResult}
            gameCanBeStarted={gameCanBeStarted}
            startGame={startGame}
            giveHint={giveHint}
            revealWord={revealWord}
            endTurn={endTurn}
            endGame={endGame}
          />
        )}
      </main>
      <footer className="row-start-3 mb-2">
        <GameControls
          gameResult={gameResult}
          gameIsRunning={gameIsRunning}
          gameCanBeStarted={gameCanBeStarted}
          currentPlayer={currentPlayer}
          turn={turn}
          endGame={endGame}
          startGame={startGame}
          endTurn={endTurn}
        />
      </footer>
    </div>
  );
}
