"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import useCodenames from "@/components/hooks/useCodenames";
import Lobby from "@/components/Game/Lobby/Lobby";
import GameControls from "@/components/Game/GameControls";
import Board from "@/components/Game/Board/Board";
import SessionStatus from "@/components/Game/SessionStatus";
import SplashScreen from "@/components/SplashScreen";
import PracticeMode from "@/components/PracticeMode/PracticeMode";
import Tutorial from "@/components/Tutorial/Tutorial";
import useSoundEffects from "@/components/hooks/useSoundEffects";
import Confetti from "@/components/Confetti";
import { GameResult, WordCard } from "schema";

export default function Home() {
  const searchParams = useSearchParams();
  const hasSession = !!searchParams?.get("session");
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
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

  const sound = useSoundEffects();

  // Sound effects based on game state changes
  const prevTurnTeamRef = useRef<number | undefined>(undefined);
  const prevGameResultRef = useRef<GameResult | undefined>(undefined);
  const prevBoardRef = useRef<WordCard[] | undefined>(undefined);

  useEffect(() => {
    // Detect turn change
    if (
      turn?.team !== undefined &&
      prevTurnTeamRef.current !== undefined &&
      turn.team !== prevTurnTeamRef.current
    ) {
      sound.turnChange();
    }
    prevTurnTeamRef.current = turn?.team;

    // Detect game result
    if (gameResult && !prevGameResultRef.current) {
      if (gameResult.losingTeam !== undefined && gameResult.winningTeam === undefined) {
        sound.assassinReveal();
      } else {
        sound.gameWin();
      }
    }
    prevGameResultRef.current = gameResult;

    // Detect card reveals
    if (board && prevBoardRef.current && board !== prevBoardRef.current) {
      const prevRevealed = prevBoardRef.current.filter((c) => c.revealed).length;
      const nowRevealed = board.filter((c) => c.revealed).length;
      if (nowRevealed > prevRevealed) {
        const newlyRevealed = board.find(
          (c) =>
            c.revealed &&
            !prevBoardRef.current?.find((p) => p.word === c.word)?.revealed
        );
        if (newlyRevealed) {
          if (newlyRevealed.isAssassin) {
            // assassin sound handled by game result
          } else if (newlyRevealed.team === turn?.team || newlyRevealed.team === prevTurnTeamRef.current) {
            sound.correctGuess();
          } else {
            sound.wrongGuess();
          }
        }
      }
    }
    prevBoardRef.current = board;
  }, [board, turn?.team, gameResult, sound]);

  // Show tutorial if requested
  if (showTutorial) {
    return <Tutorial onComplete={() => setShowTutorial(false)} />;
  }

  if (showPractice) {
    return <PracticeMode onExit={() => setShowPractice(false)} />;
  }

  // Show splash screen if not connecting yet
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) {
    if (skipConnection) {
      return (
        <SplashScreen
          onPlay={() => setWantsToPlay(true)}
          onLearnToPlay={() => setShowTutorial(true)}
          onPractice={() => setShowPractice(true)}
        />
      );
    }
    return null;
  }

  const gameIsRunning = turn !== undefined;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-[radial-gradient(ellipse_at_center,_#2a1f48_0%,_#0f0f1a_70%)] p-4 pt-6 font-[family-name:var(--font-geist-sans)]">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <Logo />
        <button
          className="rounded-xl bg-surface px-2 py-1 text-lg"
          onClick={sound.toggleMute}
          title={sound.muted ? "Unmute" : "Mute"}
        >
          {sound.muted ? "🔇" : "🔊"}
        </button>
        <SessionStatus isConnected={isConnected} sessionName={sessionName} />
      </header>
      <main className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6">
        {turn === undefined ? (
          <Lobby
            players={players}
            currentPlayerId={currentPlayerId}
            promoteToSpymaster={promoteToSpymaster}
            setName={setName}
            gameCanBeStarted={gameCanBeStarted}
            startGame={startGame}
            onBackToHome={() => {
              window.location.href = window.location.pathname;
            }}
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
          players={players}
          endGame={endGame}
          startGame={startGame}
          endTurn={endTurn}
          promoteToSpymaster={promoteToSpymaster}
        />
      </footer>
      <Confetti active={!!gameResult?.winningTeam} />
    </div>
  );
}
