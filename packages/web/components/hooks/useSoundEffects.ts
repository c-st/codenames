import { SharedEffect } from "schema";
import { useCallback, useEffect, useRef, useState } from "react";

type OscillatorType = "sine" | "square" | "triangle" | "sawtooth";

const TEAM_CHIMES: [number, number][] = [
  [494, 659],
  [440, 554],
  [587, 740],
  [392, 494],
];

const useSoundEffects = () => {
  const ctxRef = useRef<AudioContext | null>(null);

  const scheduledAtRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    try {
      setMuted(localStorage.getItem("codenames:muted") === "true");
    } catch {
      /* Storage unavailable */
    }
    const unlock = () => {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
      if (ctxRef.current.state === "suspended")
        void ctxRef.current.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);
  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("codenames:muted", String(next));
      } catch {
        /* Storage unavailable */
      }
      return next;
    });
  }, []);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (
      freq: number,
      duration: number,
      type: OscillatorType = "sine",
      volume: number = 0.3,
      delay: number = 0,
    ) => {
      if (muted) return;
      const ctx = getCtx();
      if (ctx.state !== "running") return;
      const start =
        Math.max(ctx.currentTime, scheduledAtRef.current ?? ctx.currentTime) +
        delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    },
    [getCtx, muted],
  );

  const cardTap = useCallback(() => {
    playTone(600, 0.08, "sine", 0.2);
    playTone(800, 0.06, "sine", 0.15, 0.03);
  }, [playTone]);

  const correctGuess = useCallback(() => {
    playTone(523, 0.12, "sine", 0.25);
    playTone(659, 0.12, "sine", 0.25, 0.1);
    playTone(784, 0.2, "sine", 0.3, 0.2);
  }, [playTone]);

  const wrongGuess = useCallback(() => {
    playTone(400, 0.15, "triangle", 0.25);
    playTone(300, 0.25, "triangle", 0.2, 0.12);
  }, [playTone]);

  const assassinReveal = useCallback(() => {
    playTone(200, 0.4, "sawtooth", 0.2);
    playTone(100, 0.6, "sawtooth", 0.25, 0.2);
  }, [playTone]);

  const gameWin = useCallback(() => {
    playTone(523, 0.1, "sine", 0.25);
    playTone(659, 0.1, "sine", 0.25, 0.1);
    playTone(784, 0.1, "sine", 0.25, 0.2);
    playTone(1047, 0.3, "sine", 0.3, 0.3);
  }, [playTone]);

  // Each team gets its own two-note chime so you can hear whose turn it is.
  const turnChange = useCallback(
    (team = 0) => {
      const [low, high] = TEAM_CHIMES[team % TEAM_CHIMES.length];
      playTone(low, 0.15, "sine", 0.12);
      playTone(high, 0.18, "sine", 0.1, 0.09);
    },
    [playTone],
  );

  // A quick riffle of cards being dealt, then a bright "let's go".
  const gameStart = useCallback(() => {
    for (let i = 0; i < 8; i++)
      playTone(900 - i * 40, 0.035, "triangle", 0.08, i * 0.04);
    playTone(587, 0.12, "sine", 0.2, 0.38);
    playTone(784, 0.25, "sine", 0.22, 0.48);
  }, [playTone]);

  const perfectClue = useCallback(() => {
    [1047, 1319, 1568, 2093].forEach((freq, i) =>
      playTone(freq, 0.18, "sine", 0.16, i * 0.07),
    );
  }, [playTone]);

  // Heartbeat for the last seconds of a turn: lub-dub, getting a little louder.
  const tick = useCallback(
    (secondsLeft: number) => {
      const urgency = Math.max(0, 10 - secondsLeft) / 10;
      playTone(70, 0.09, "sine", 0.25 + urgency * 0.2);
      playTone(60, 0.11, "sine", 0.18 + urgency * 0.15, 0.13);
    },
    [playTone],
  );

  const timeUp = useCallback(() => {
    playTone(220, 0.18, "square", 0.08);
    playTone(165, 0.3, "square", 0.08, 0.16);
  }, [playTone]);

  const pop = useCallback(() => {
    playTone(1200, 0.05, "sine", 0.08);
  }, [playTone]);

  const haptic = useCallback(
    (pattern: number | number[]) => {
      if (muted) return;
      try {
        navigator.vibrate?.(pattern);
      } catch {
        /* Not supported */
      }
    },
    [muted],
  );

  const buttonClick = useCallback(() => {
    playTone(700, 0.05, "sine", 0.1);
  }, [playTone]);

  const playSharedEffect = useCallback(
    (effect: SharedEffect, delaySeconds: number) => {
      const ctx = ctxRef.current;
      if (muted || !ctx || ctx.state !== "running") return;
      scheduledAtRef.current = ctx.currentTime + Math.max(0, delaySeconds);
      const cues: Record<SharedEffect["type"], () => void> = {
        correctGuess,
        wrongGuess,
        assassinReveal,
        gameWin,
        gameStart,
        perfectClue,
        turnChange: () => turnChange(effect.team),
      };
      cues[effect.type]();
      scheduledAtRef.current = null;
    },
    [
      muted,
      correctGuess,
      wrongGuess,
      assassinReveal,
      gameWin,
      turnChange,
      gameStart,
      perfectClue,
    ],
  );

  return {
    playSharedEffect,
    cardTap,
    correctGuess,
    wrongGuess,
    assassinReveal,
    gameWin,
    turnChange,
    gameStart,
    perfectClue,
    tick,
    timeUp,
    pop,
    haptic,
    buttonClick,
    muted,
    toggleMute,
  };
};

export default useSoundEffects;
export type SoundEffects = ReturnType<typeof useSoundEffects>;
