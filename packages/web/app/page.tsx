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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_center,_#2a1f48_0%,_#0f0f1a_70%)] p-4 font-[family-name:var(--font-geist-sans)]">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <Logo />
        <SessionStatus isConnected={isConnected} sessionName={sessionName} />
      </header>
      <main className="flex w-full max-w-4xl flex-col items-center gap-6">
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
      <footer>
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
