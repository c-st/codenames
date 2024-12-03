"use client";

import SessionStatus from "@/components/SessionStatus";
import Logo from "@/components/ui/Logo";
import useCodenames from "@/components/hooks/useCodenames";
import Lobby from "@/components/Lobby";
import Board from "@/components/Board";
import { Button } from "@/components/ui/Button";

export default function Home() {
  const {
    sessionName,
    isConnected,
    // resetGame,
    // closeConnection,
    promoteToSpymaster,
    setName,
    players,
    turn,
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
  } = useCodenames();

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) {
    return null;
  }

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] justify-items-center p-1.5 font-[family-name:var(--font-geist-sans)] md:p-8 lg:p-20 lg:pt-8">
      <header className="row-start-1 flex w-full items-center justify-between">
        <Logo />
        <div className="">
          <SessionStatus isConnected={isConnected} sessionName={sessionName} />
        </div>
      </header>
      <main className="row-start-2 flex flex-col gap-8 pt-6 sm:items-start">
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
      <footer className="row-start-3 flex h-full flex-col gap-8">
        {!gameResult &&
          gameCanBeStarted &&
          currentPlayer.team === turn?.team && (
            <Button title="End turn" onClick={endTurn} />
          )}
        {!gameResult && gameCanBeStarted && (
          <div className="">
            <Button title="End game" type="destructive" onClick={endGame} />
          </div>
        )}
      </footer>
    </div>
  );
}
