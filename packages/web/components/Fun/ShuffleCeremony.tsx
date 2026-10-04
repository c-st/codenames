import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Player } from "schema";
import type { SoundEffects } from "@/components/hooks/useSoundEffects";
import Sparkles from "./Sparkles";

const REVEAL_MS = 1400;

/**
 * Follows the room's shared shuffle deadline on the server clock, so every screen
 * counts down together. `revealing` briefly stays true after the teams changed.
 */
export function useShuffleCountdown(
  shuffleAt: number | undefined,
  serverClockOffset: number,
) {
  const [secondsLeft, setSecondsLeft] = useState<number>();
  const [revealing, setRevealing] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (shuffleAt === undefined) {
      setSecondsLeft(undefined);
      return;
    }
    const update = () =>
      setSecondsLeft(
        Math.max(
          0,
          Math.ceil((shuffleAt - (Date.now() + serverClockOffset)) / 1000),
        ),
      );
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [shuffleAt, serverClockOffset]);

  // The reveal is the moment the server's shuffled roster arrives.
  useEffect(() => {
    const pending = shuffleAt !== undefined;
    if (wasPending.current && !pending) {
      setRevealing(true);
      const timer = setTimeout(() => setRevealing(false), REVEAL_MS);
      wasPending.current = pending;
      return () => clearTimeout(timer);
    }
    wasPending.current = pending;
  }, [shuffleAt]);

  return { secondsLeft, revealing, shuffling: shuffleAt !== undefined };
}

/** Full-screen countdown with everyone's animals swirling, then a burst as teams land. */
export default function ShuffleCeremony({
  secondsLeft,
  revealing,
  players,
  sound,
}: {
  secondsLeft?: number;
  revealing: boolean;
  players: Player[];
  sound: Pick<SoundEffects, "shuffleCount" | "shuffleReveal" | "haptic">;
}) {
  const reduceMotion = useReducedMotion();
  const counting = secondsLeft !== undefined;
  const { shuffleCount, shuffleReveal, haptic } = sound;

  useEffect(() => {
    if (secondsLeft === undefined || secondsLeft < 1) return;
    shuffleCount(secondsLeft);
    haptic(15);
  }, [secondsLeft, shuffleCount, haptic]);
  useEffect(() => {
    if (!revealing) return;
    shuffleReveal();
    haptic([20, 40, 60]);
  }, [revealing, shuffleReveal, haptic]);

  const animals = players.slice(0, 12).map((p) => p.animal ?? "🐾");

  return (
    <AnimatePresence>
      {(counting || revealing) && (
        <motion.div
          key="shuffle-ceremony"
          role="status"
          aria-live="assertive"
          data-shuffle={counting ? "counting" : "revealed"}
          className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-base/45 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
        >
          <div className="relative grid h-72 w-72 place-items-center">
            {/* Everyone's animals whirl around the count like a deck being shuffled. */}
            <motion.div
              aria-hidden="true"
              className="absolute inset-0"
              animate={
                reduceMotion ? undefined : { rotate: counting ? 360 : 720 }
              }
              transition={{
                duration: counting ? 1.6 : 0.8,
                ease: counting ? "linear" : "easeOut",
                repeat: counting ? Infinity : 0,
              }}
            >
              {animals.map((animal, i) => {
                const angle = (i / animals.length) * Math.PI * 2;
                const radius = revealing ? 180 : 120;
                return (
                  <motion.span
                    key={i}
                    className="absolute left-1/2 top-1/2 -ml-5 -mt-5 grid h-10 w-10 select-none place-items-center rounded-full bg-elevated/90 text-2xl shadow-[0_0_14px_rgba(160,112,224,0.6)]"
                    animate={{
                      x: Math.cos(angle) * radius,
                      y: Math.sin(angle) * radius,
                      opacity: revealing ? 0 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  >
                    {animal}
                  </motion.span>
                );
              })}
            </motion.div>

            <div className="ring-gold ring-turn relative grid h-40 w-40 place-items-center rounded-full bg-[radial-gradient(circle_at_50%_35%,_#4a3580,_#1e1638_70%)] shadow-[0_0_70px_rgba(160,112,224,0.65)]">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={revealing ? "done" : secondsLeft}
                  className="select-none text-center font-black !text-white drop-shadow-[0_0_18px_rgba(255,208,96,0.8)]"
                  initial={{ scale: 2.2, opacity: 0, rotate: -12 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 16 }}
                >
                  {revealing ? (
                    <span className="text-4xl">🎲</span>
                  ) : secondsLeft ? (
                    <span className="text-8xl tabular-nums">{secondsLeft}</span>
                  ) : (
                    <span className="text-3xl">…</span>
                  )}
                </motion.span>
              </AnimatePresence>
              {revealing && <Sparkles color="#ffd060" count={18} />}
            </div>
          </div>
          <motion.p
            key={revealing ? "revealed" : "counting"}
            className="absolute bottom-[18%] select-none text-2xl font-black tracking-wide !text-white drop-shadow-[0_0_12px_rgba(160,112,224,0.9)]"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            {revealing ? "Shuffled!" : "Shuffling teams…"}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
