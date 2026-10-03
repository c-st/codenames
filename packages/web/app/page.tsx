"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/ui/Logo";
import useCodenames from "@/components/hooks/useCodenames";
import Lobby from "@/components/Game/Lobby/Lobby";
import GameControls from "@/components/Game/GameControls";
import Board from "@/components/Game/Board/Board";
import SessionHistory from "@/components/Game/SessionHistory";
import SessionStatus from "@/components/Game/SessionStatus";
import SplashScreen from "@/components/SplashScreen";
import PracticeMode from "@/components/PracticeMode/PracticeMode";
import Tutorial from "@/components/Tutorial/Tutorial";
import useSoundEffects from "@/components/hooks/useSoundEffects";
import Confetti from "@/components/Confetti";
import { MotionConfig } from "motion/react";
import TurnBanner from "@/components/Fun/TurnBanner";
import ScreenFlash from "@/components/Fun/ScreenFlash";
import { FloatingReactions, ReactionBar } from "@/components/Fun/Reactions";
import useVisualCues from "@/components/Fun/useVisualCues";
import { getTeamColor } from "@/components/Game/Board/getTeamColor";

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
    setProfile,
    players,
    turn,
    hintHistory,
    sessionHistory,
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
    wordPack,
    teamCount,
    setWordPack,
    setTeamCount,
    randomizeName,
    celebration,
    marks,
    markCard,
    typingPlayerIds,
    setTyping,
    turnSeconds,
    reactions,
    react,
    customWords,
    setCustomWords,
    shuffleTeams,
    effects,
    serverClockOffset,
    commandError,
    sessionError,
    retrySession,
  } = useCodenames(skipConnection);

  const sound = useSoundEffects();

  const { playSharedEffect } = sound;
  useEffect(() => {
    for (const effect of effects) {
      const delay = effect.playAt - (Date.now() + serverClockOffset);
      // Joining/reconnecting never replays old cues. Muting never queues audio.
      if (delay >= -1000) playSharedEffect(effect, delay / 1000);
    }
    // Only new authoritative events schedule playback; clock/mute changes do not replay them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effects]);

  const { banner, lastBanner, flashId, lastFlashId, shakeScope } =
    useVisualCues(effects, serverClockOffset, sessionName);

  // A little pop whenever someone's reaction floats in.
  const { pop } = sound;
  const lastReactionRef = useRef<string>(undefined);
  useEffect(() => {
    const latest = reactions.at(-1)?.id;
    if (latest && latest !== lastReactionRef.current) pop();
    lastReactionRef.current = latest;
  }, [reactions, pop]);

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
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-white"
        role="status"
      >
        <Logo />
        <p>{sessionError ?? "Connecting to your room…"}</p>
        {sessionError && (
          <button
            className="rounded-xl bg-primary px-4 py-2"
            onClick={retrySession}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const gameIsRunning = turn !== undefined;

  return (
    <MotionConfig reducedMotion="user">
      {/* Sparkles, scaled cards and the assassin shake must never widen the page on phones. */}
      <div className="overflow-x-clip">
        <div
          ref={shakeScope}
          className="flex min-h-screen flex-col items-center gap-6 bg-[radial-gradient(ellipse_at_center,_#2a1f48_0%,_#0f0f1a_70%)] p-4 pt-6 font-[family-name:var(--font-geist-sans)]"
        >
          <header className="grid w-full max-w-4xl grid-cols-[1fr_auto] items-center gap-2 md:flex md:justify-between">
            <Logo />
            <button
              className="rounded-xl bg-surface px-2 py-1 text-lg"
              onClick={sound.toggleMute}
              title={sound.muted ? "Unmute" : "Mute"}
            >
              {sound.muted ? "🔇" : "🔊"}
            </button>
            <SessionStatus
              isConnected={isConnected}
              sessionName={sessionName}
            />
          </header>
          {commandError && (
            <p
              role="alert"
              className="rounded-xl bg-amber-900/40 px-4 py-2 text-amber-200"
            >
              {commandError}
            </p>
          )}
          <main className="flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6">
            {turn === undefined ? (
              <fieldset disabled={!isConnected} className="w-full">
                <Lobby
                  players={players}
                  currentPlayerId={currentPlayerId}
                  promoteToSpymaster={promoteToSpymaster}
                  setProfile={setProfile}
                  randomizeName={randomizeName}
                  gameCanBeStarted={gameCanBeStarted}
                  startGame={startGame}
                  customWords={customWords}
                  setCustomWords={setCustomWords}
                  shuffleTeams={shuffleTeams}
                  roomId={sessionName}
                  wordPack={wordPack}
                  teamCount={teamCount}
                  setWordPack={setWordPack}
                  setTeamCount={setTeamCount}
                  onBackToHome={() => {
                    window.location.href = window.location.pathname;
                  }}
                />
              </fieldset>
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
                giveHint={giveHint}
                revealWord={revealWord}
                marks={marks}
                markCard={markCard}
                typingPlayerIds={typingPlayerIds}
                setTyping={setTyping}
                turnSeconds={turnSeconds}
                sound={sound}
              />
            )}
            <SessionHistory history={sessionHistory} />
          </main>
          <footer className="flex w-full max-w-4xl flex-col items-center gap-4">
            <fieldset disabled={!isConnected} className="min-w-0 max-w-full">
              <ReactionBar onReact={react} />
            </fieldset>
            {/* min-w-0: fieldsets otherwise refuse to shrink below their content on phones. */}
            <fieldset disabled={!isConnected} className="w-full min-w-0">
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
            </fieldset>
          </footer>
          <Confetti
            celebration={celebration}
            teamColor={getTeamColor(currentPlayer.team).hex}
          />
          <TurnBanner
            banner={banner}
            lastBanner={lastBanner}
            myTeam={currentPlayer.team}
          />
          <ScreenFlash flashId={flashId} lastFlashId={lastFlashId} />
          <FloatingReactions reactions={reactions} players={players} />
        </div>
      </div>
    </MotionConfig>
  );
}
