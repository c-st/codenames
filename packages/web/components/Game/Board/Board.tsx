import { useEffect, useRef, useState } from "react";
import { CardMark, GameResult, HintHistory, Player, Turn, WordCard } from "schema";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  TargetAndTransition,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { useWarnBeforeReloading } from "@/components/hooks/useWarnBeforeReloading";
import type { SoundEffects } from "@/components/hooks/useSoundEffects";
import Sparkles from "@/components/Fun/Sparkles";
import HintInput from "./HintInput";
import { getTeamColor, getTeamName } from "./getTeamColor";
import TeamInfo from "./TeamInfo";
import AnimalAvatar from "@/components/ui/AnimalAvatar";
import { getSpymasterTitle } from "../spymasterTitle";

export default function Board({
  isConnected,
  players,
  currentPlayerId,
  words,
  turn,
  hintHistory,
  remainingWordsByTeam,
  gameResult,
  giveHint,
  revealWord,
  marks,
  markCard,
  typingPlayerIds,
  setTyping,
  turnSeconds,
  sound,
}: {
  isConnected: boolean;
  players: Player[];
  currentPlayerId: string;
  words?: WordCard[];
  turn: Turn;
  hintHistory: HintHistory;
  remainingWordsByTeam: number[];
  gameResult?: GameResult;
  giveHint: (hint: string, count: number) => void;
  revealWord: (word: string) => void;
  marks: CardMark[];
  markCard: (word: string) => void;
  typingPlayerIds: string[];
  setTyping: (typing: boolean) => void;
  turnSeconds: number;
  sound: SoundEffects;
}) {
  useWarnBeforeReloading(isConnected);

  const { until } = turn;

  // The current clue is shown big; earlier ones (all teams, newest first) become chips.
  const previousHints = hintHistory
    .slice(0, turn.hint ? -1 : undefined)
    .reverse();

  if (words === undefined) {
    return null;
  }
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  if (!currentPlayer) {
    return null;
  }

  const isCurrentTurn = currentPlayer.team === turn.team;
  const thinkingSpymaster = !turn.hint
    ? players.find((p) => p.role === "spymaster" && p.team === turn.team && p.id !== currentPlayer.id && typingPlayerIds.includes(p.id))
    : undefined;

  // Build status message
  const statusMessage = (() => {
    if (gameResult) return null;
    if (!isConnected)
      return "Reconnecting — guesses will resume when connected.";
    if (thinkingSpymaster)
      return `${thinkingSpymaster.animal ?? "🤔"} ${thinkingSpymaster.name} is cooking up a clue`;
    if (!isCurrentTurn) return "Waiting for the other team...";
    if (currentPlayer.role === "spymaster" && !turn.hint)
      return "Your turn — give a hint!";
    if (currentPlayer.role === "spymaster" && turn.hint)
      return "Your team is guessing...";
    if (turn.hint) return "Your turn — tap a word to guess!";
    return `Waiting for your ${getSpymasterTitle()}'s hint...`;
  })();

  const canGuess =
    isConnected &&
    !gameResult &&
    isCurrentTurn &&
    currentPlayer.role === "operative" &&
    !!turn.hint &&
    (turn.guessesRemaining === undefined || turn.guessesRemaining > 0);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-4">
        <TeamInfo
          isGameOver={!!gameResult}
          players={players}
          currentPlayer={currentPlayer}
          turn={turn}
          remainingWordsByTeam={remainingWordsByTeam}
        />
        {statusMessage && (
          <motion.div
            key={statusMessage}
            role="status"
            className={`rounded-2xl border px-4 py-3 text-center text-lg font-bold backdrop-blur ${
              isCurrentTurn
                ? "border-accent/40 bg-accent/15 text-purple-100 shadow-[0_0_28px_-6px_rgba(160,112,224,0.7)]"
                : "border-purple-400/15 bg-surface/70 text-purple-300/80"
            }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {statusMessage}
            {thinkingSpymaster && <ThinkingDots />}
          </motion.div>
        )}
        <div className="flex items-start justify-between gap-3">
          {!gameResult && (
            <Hint
              turn={turn}
              giveHint={giveHint}
              setTyping={setTyping}
              isCurrentlySpymaster={
                isConnected &&
                currentPlayer.role === "spymaster" &&
                isCurrentTurn
              }
            />
          )}
          {gameResult && <Result gameResult={gameResult} players={players} />}
          {gameResult === undefined && (
            <Timer key={+new Date(until)} until={until} totalSeconds={turnSeconds} sound={sound} />
          )}
        </div>
        <WordMatrix
          canGuess={canGuess}
          canMark={canGuess}
          isGameOver={!!gameResult}
          words={words}
          turn={turn}
          players={players}
          marks={marks}
          currentPlayer={currentPlayer}
          onRevealWord={revealWord}
          onMarkWord={markCard}
          sound={sound}
        />
        {!gameResult && previousHints.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Previous clues">
            <span className="text-sm font-semibold text-purple-300/60">Earlier:</span>
            {previousHints.map((hint) => {
              const color = getTeamColor(hint.team);
              return (
                <motion.span
                  key={hint.inTurn}
                  layout
                  className={`rounded-full bg-gradient-to-br ${color.badgeFrom} ${color.badgeTo} px-3 py-1 font-mono text-sm font-bold !text-white/90`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {hint.hint} · {hint.count}
                </motion.span>
              );
            })}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

function ThinkingDots() {
  return (
    <span aria-hidden="true" className="ml-1 inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-dot-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          .
        </span>
      ))}
    </span>
  );
}

function Result({
  gameResult,
  players,
}: {
  gameResult?: GameResult;
  players: Player[];
}) {
  const reduceMotion = useReducedMotion();
  const { winningTeam, losingTeam } = gameResult || {};
  const isWin = winningTeam !== undefined;
  const resultTeam = winningTeam ?? losingTeam;
  const color = resultTeam !== undefined ? getTeamColor(resultTeam) : null;
  const teamPlayers =
    resultTeam !== undefined
      ? players.filter((p) => p.team === resultTeam)
      : [];

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      {/* Trophy / skull */}
      <motion.div
        className="text-6xl"
        initial={{ scale: 0.85, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.1 }}
      >
        {isWin ? "🏆" : "💀"}
      </motion.div>

      {/* Headline */}
      <motion.h2
        className="select-none text-center text-3xl font-black md:text-4xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
      >
        {isWin
          ? `Team ${getTeamName(winningTeam!)} wins!`
          : `Team ${getTeamName(losingTeam!)} loses...`}
      </motion.h2>

      {/* Winning podium */}
      {teamPlayers.length > 0 && color && (
        <motion.div
          className="glass-panel glass-wash flex flex-col items-center gap-3 px-8 py-6"
          style={{ ["--wash" as string]: color.hex, boxShadow: `0 0 50px -10px ${color.hex}` }}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            delay: 0.4,
          }}
        >
          <div className="relative flex flex-wrap justify-center gap-4">
            {teamPlayers.map((player, i) => (
              <motion.div
                key={player.id}
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 24,
                  delay: 0.3 + Math.min(i, 5) * 0.04,
                }}
              >
                <motion.span
                  className="relative"
                  animate={isWin && !reduceMotion ? { y: [0, -8, 0] } : {}}
                  transition={{
                    repeat: isWin ? 2 : 0,
                    duration: 0.4,
                    delay: 0.7 + i * 0.15,
                  }}
                >
                  <AnimalAvatar
                    animal={player.animal}
                    crowned={player.role === "spymaster"}
                    glow={isWin}
                    glowColor={color.hex}
                  />
                </motion.span>
                <span className="max-w-20 truncate text-center text-xs font-semibold !text-white/80">
                  {player.name}
                </span>
                <span
                  className={`text-[0.6rem] font-bold ${player.role === "spymaster" ? "text-amber-300" : "text-white/50"}`}
                >
                  {player.role === "spymaster"
                    ? getSpymasterTitle()
                    : "Operative"}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}


function Hint({
  turn,
  giveHint,
  setTyping,
  isCurrentlySpymaster,
}: {
  turn: Turn;
  giveHint: (hint: string, count: number) => void;
  setTyping: (typing: boolean) => void;
  isCurrentlySpymaster: boolean;
}) {
  return (
    <div>
      <AnimatePresence mode="wait">
        {turn.hint ? (
          // The clue lands like a rubber stamp.
          <motion.div
            key={turn.hint.hint}
            className="flex items-baseline gap-2"
            initial={{ opacity: 0, scale: 2.4, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -2 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            <span className="rounded-lg border-4 border-double border-amber-300/80 px-3 py-0.5 font-mono text-2xl font-black uppercase tracking-wide text-amber-200">
              {turn.hint.hint} · {turn.hint.count}
            </span>
            {turn.guessesRemaining !== undefined && (
              <motion.span
                key={turn.guessesRemaining}
                className="text-sm text-purple-400"
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {turn.guessesRemaining} guess
                {turn.guessesRemaining !== 1 ? "es" : ""} left
              </motion.span>
            )}
          </motion.div>
        ) : (
          isCurrentlySpymaster && (
            <motion.div
              key="hint-input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <HintInput giveHint={giveHint} onTyping={setTyping} />
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}

const RING_RADIUS = 20;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function Timer({ until, totalSeconds, sound }: { until: Date; totalSeconds: number; sound: SoundEffects }) {
  const deadline = +new Date(until);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );
  const previousRef = useRef(secondsLeft);
  const [scope, animate] = useAnimate();
  const { tick, timeUp } = sound;

  useEffect(() => {
    const update = () =>
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    // Catch up immediately after returning to a backgrounded tab.
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline]);

  // Heartbeat for the final ten seconds, a buzzer and a shake at zero.
  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = secondsLeft;
    if (secondsLeft === previous) return;
    if (secondsLeft > 0 && secondsLeft <= 10) tick(secondsLeft);
    if (secondsLeft === 0 && previous > 0) {
      timeUp();
      void animate(scope.current, { x: [0, -8, 8, -6, 6, -3, 0], rotate: [0, -6, 6, -4, 4, 0] }, { duration: 0.5 });
    }
  }, [secondsLeft, tick, timeUp, animate, scope]);

  const fraction = Math.min(1, secondsLeft / Math.max(1, totalSeconds));
  const urgent = secondsLeft <= 15;
  const critical = secondsLeft <= 5;
  const stroke = critical ? "#ef4444" : urgent ? "#fcd34d" : "#a070e0";

  return (
    <motion.div
      ref={scope}
      data-urgency={critical ? "critical" : urgent ? "urgent" : "calm"}
      className="relative flex h-14 w-14 shrink-0 items-center justify-center"
      animate={critical && secondsLeft > 0 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={critical ? { duration: 0.5, repeat: Infinity } : undefined}
    >
      <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={RING_RADIUS} fill="none" stroke="rgba(160,112,224,0.15)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={RING_RADIUS} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
        />
      </svg>
      <span
        role="timer"
        aria-label={`${secondsLeft} seconds remaining`}
        className={`select-none font-mono text-sm font-bold tabular-nums ${critical ? "text-red-400" : urgent ? "text-amber-300" : "text-purple-200"}`}
      >
        {secondsLeft >= 60 ? `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}` : secondsLeft}
      </span>
    </motion.div>
  );
}

function WordMatrix({
  canGuess,
  canMark,
  isGameOver,
  words,
  players,
  marks,
  currentPlayer,
  turn,
  onRevealWord,
  onMarkWord,
  sound,
}: {
  canGuess: boolean;
  canMark: boolean;
  isGameOver: boolean;
  words: WordCard[];
  players: Player[];
  marks: CardMark[];
  currentPlayer: Player;
  turn: Turn;
  onRevealWord: (word: string) => void;
  onMarkWord: (word: string) => void;
  sound: SoundEffects;
}) {
  const teamColor = getTeamColor(turn.team);
  // A new board (new game) remounts the grid, so the cards get dealt again.
  const dealKey = words.map((card) => card.word).join("|");

  return (
    <motion.div
      key={dealKey}
      className="grid grid-cols-5 grid-rows-5 gap-2 rounded-2xl border-8 border-solid p-2"
      initial={{ borderColor: `${teamColor.hex}66` }}
      animate={{
        borderColor: `${teamColor.hex}${isGameOver ? "33" : "88"}`,
        boxShadow: isGameOver ? "0 0 0 transparent" : `0 0 32px ${teamColor.hex}33`,
      }}
      transition={{ duration: 0.6 }}
    >
      {words.map((wordCard, index) => (
        <Word
          index={index}
          canGuess={canGuess}
          canMark={canMark}
          isGameOver={isGameOver}
          key={wordCard.word}
          wordCard={wordCard}
          currentPlayer={currentPlayer}
          markers={marks
            .filter((mark) => mark.word === wordCard.word)
            .map((mark) => players.find((p) => p.id === mark.playerId))
            .filter((p): p is Player => !!p)}
          onRevealWord={onRevealWord}
          onMarkWord={onMarkWord}
          sound={sound}
        />
      ))}
    </motion.div>
  );
}

type Landing = "correct" | "wrong" | "assassin";

const faceStyle = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;

function Word({
  index,
  canGuess,
  canMark,
  isGameOver,
  wordCard,
  currentPlayer,
  markers,
  onRevealWord,
  onMarkWord,
  sound,
}: {
  index: number;
  canGuess: boolean;
  canMark: boolean;
  isGameOver: boolean;
  wordCard: WordCard;
  currentPlayer: Player;
  markers: Player[];
  onRevealWord: (word: string) => void;
  onMarkWord: (word: string) => void;
  sound: SoundEffects;
}) {
  const reduceMotion = useReducedMotion();
  const isRevealed = !!wordCard.revealed;
  const isInteractive = canGuess && !isRevealed;
  const isMarkable = canMark && !isRevealed;
  const isSpymaster = currentPlayer.role === "spymaster";
  const showWord = isRevealed || isSpymaster || isGameOver;
  const isMarkedByMe = markers.some((p) => p.id === currentPlayer.id);

  // "Thinking" wiggle between the tap and the server's answer.
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), 2500);
    return () => clearTimeout(timer);
  }, [pending]);

  // Play the landing only for reveals that happen while we watch, never on (re)connect.
  const [landing, setLanding] = useState<Landing>();
  // Unlike the animation itself, remembers which landing this card played.
  const [lastLanding, setLastLanding] = useState<Landing>();
  const wasRevealed = useRef(isRevealed);
  const { haptic } = sound;
  useEffect(() => {
    if (!isRevealed || wasRevealed.current) {
      wasRevealed.current = isRevealed;
      return;
    }
    wasRevealed.current = true;
    setPending(false);
    const kind: Landing = wordCard.isAssassin
      ? "assassin"
      : wordCard.team === wordCard.revealed?.byTeam ? "correct" : "wrong";
    setLanding(kind);
    setLastLanding(kind);
    haptic(kind === "assassin" ? [80, 40, 160] : kind === "wrong" ? [30, 30, 30] : 20);
    const timer = setTimeout(() => setLanding(undefined), 1600);
    return () => clearTimeout(timer);
    // Only the face-down → face-up transition matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealed]);

  const front = (() => {
    if (!showWord) return { bg: "bg-[#f5f0ff] card-shadow-default", text: "!text-[#1a1530]", dim: false };
    return { ...revealedStyle(wordCard), dim: !isRevealed };
  })();
  const back = revealedStyle(wordCard);
  const landingAnimation: Record<Landing, TargetAndTransition> = {
    correct: { scale: [1, 1.14, 0.97, 1], rotate: 0 },
    wrong: { scale: 1, rotate: [0, -7, 6, -4, 2, 0] },
    assassin: { scale: [1, 1.4, 1.25, 1], rotate: [0, -4, 4, 0] },
  };
  const flipDelay = 0.32;

  const toggleMark = () => {
    if (!isMarkable) return;
    sound.buttonClick();
    sound.haptic(8);
    onMarkWord(wordCard.word);
  };

  return (
    // Outer layer: deal-in when the board appears.
    <motion.div
      className="relative min-w-0"
      data-landing={landing}
      data-last-landing={lastLanding}
      style={{ perspective: 800, zIndex: landing === "assassin" ? 20 : landing ? 10 : undefined }}
      initial={reduceMotion ? false : { opacity: 0, y: -60, rotate: (index % 5 - 2) * 9, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: reduceMotion ? 0 : 0.15 + index * 0.035 }}
    >
      {/* Middle layer: thinking wiggle and landing juice. */}
      <motion.div
        className="relative"
        animate={
          landing
            ? { ...landingAnimation[landing], transition: { delay: flipDelay, duration: landing === "assassin" ? 0.7 : 0.5 } }
            : pending
              ? { rotate: [0, -2.5, 2.5, -1.5, 0], scale: 0.97, transition: { duration: 0.5, repeat: Infinity } }
              : { rotate: 0, scale: 1 }
        }
      >
        <motion.button
          type="button"
          disabled={!isInteractive}
          aria-label={`${wordCard.word}${isRevealed ? ", revealed" : ""}${showWord ? (wordCard.isAssassin ? ", assassin" : wordCard.team !== undefined ? `, Team ${getTeamName(wordCard.team)}` : ", neutral") : ""}${markers.length ? `, marked by ${markers.map((p) => p.name).join(", ")}` : ""}`}
          className={`relative grid min-h-14 w-full min-w-0 rounded-[14px] md:min-h-24 ${isInteractive ? "cursor-pointer" : "cursor-default"} focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-accent`}
          style={{ transformStyle: "preserve-3d" }}
          onClick={() => {
            if (!isInteractive) return;
            sound.cardTap();
            sound.haptic(12);
            setPending(true);
            onRevealWord(wordCard.word);
          }}
          onContextMenu={(event) => {
            if (!isMarkable) return;
            event.preventDefault();
            toggleMark();
          }}
          whileHover={isInteractive ? { y: -3, rotateX: 8 } : undefined}
          whileTap={isInteractive ? { scale: 0.95 } : undefined}
          initial={false}
          animate={{ rotateY: isRevealed ? 180 : 0 }}
          transition={{ rotateY: { duration: reduceMotion ? 0 : 0.6, ease: [0.3, 1.4, 0.5, 1] } }}
        >
          <CardFace className={`${front.bg} ${front.dim ? "opacity-50" : ""}`} textColor={front.text} word={wordCard.word} />
          <CardFace className={back.bg} textColor={back.text} word={wordCard.word} flipped>
            <span aria-hidden="true" className={`absolute right-1 top-0.5 text-xs md:right-2 md:top-1 ${back.text}`}>
              {wordCard.isAssassin ? "☠" : "✓"}
            </span>
          </CardFace>
        </motion.button>

        {isMarkable && (
          <motion.button
            type="button"
            aria-label={`${isMarkedByMe ? "Unmark" : "Mark"} ${wordCard.word}`}
            aria-pressed={isMarkedByMe}
            title="Mark as a maybe (right-click works too)"
            className={`absolute -left-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-md md:h-7 md:w-7 ${isMarkedByMe ? "bg-amber-400" : "bg-elevated/90 opacity-70 hover:opacity-100"}`}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            onClick={toggleMark}
          >
            📍
          </motion.button>
        )}

        {/* Teammates' tentative picks. */}
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-2 left-1 z-20 flex -space-x-1.5">
          <AnimatePresence>
            {!isRevealed && markers.map((player) => (
              <motion.span
                key={player.id}
                className="flex h-6 w-6 select-none items-center justify-center rounded-full bg-amber-300 text-sm shadow-md ring-2 ring-amber-100"
                initial={{ scale: 0, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
              >
                {player.animal ?? "🐾"}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

        {landing === "correct" && <Sparkles color={getTeamColor(wordCard.team ?? 0).hex} delay={flipDelay} />}
        {landing === "assassin" && <Sparkles color="#ef4444" emoji="💥" count={8} delay={flipDelay} />}
        <AnimatePresence>
          {landing === "wrong" && (
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-20 text-center text-2xl"
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: -36, opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, delay: flipDelay }}
            >
              {wordCard.team === undefined ? "😬" : "🙈"}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function revealedStyle(wordCard: WordCard) {
  if (wordCard.isAssassin) {
    return { bg: "bg-gradient-to-br from-red-600 to-red-400 card-shadow-assassin", text: "!text-white" };
  }
  if (wordCard.team !== undefined) {
    const color = getTeamColor(wordCard.team);
    return { bg: `bg-gradient-to-br ${color.from} ${color.to} ${color.shadow}`, text: "!text-white" };
  }
  return { bg: "bg-[#3a3550] card-shadow-neutral", text: "!text-[#8078a0]" };
}

function CardFace({ className, textColor, word, flipped, children }: {
  className: string;
  textColor: string;
  word: string;
  flipped?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={`relative flex min-w-0 flex-col items-center justify-center rounded-[14px] p-1 [grid-area:1/1] sm:p-2 md:p-4 lg:p-6 ${className}`}
      style={{ ...faceStyle, transform: flipped ? "rotateY(180deg)" : undefined }}
    >
      {children}
      <span className={`min-w-0 select-none text-center text-xs font-extrabold leading-tight [overflow-wrap:anywhere] md:text-base lg:text-xl ${textColor}`}>
        {word}
      </span>
    </span>
  );
}
