import { SharedEffect } from "schema";
import { useCallback, useEffect, useRef, useState } from "react";

type OscillatorType = "sine" | "square" | "triangle" | "sawtooth";

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

  const turnChange = useCallback(() => {
    playTone(500, 0.15, "sine", 0.1);
    playTone(600, 0.1, "sine", 0.08, 0.08);
  }, [playTone]);

  const buttonClick = useCallback(() => {
    playTone(700, 0.05, "sine", 0.1);
  }, [playTone]);

  const playSharedEffect = useCallback(
    (type: SharedEffect["type"], delaySeconds: number) => {
      const ctx = ctxRef.current;
      if (muted || !ctx || ctx.state !== "running") return;
      scheduledAtRef.current = ctx.currentTime + Math.max(0, delaySeconds);
      ({ correctGuess, wrongGuess, assassinReveal, gameWin, turnChange })[
        type
      ]();
      scheduledAtRef.current = null;
    },
    [muted, correctGuess, wrongGuess, assassinReveal, gameWin, turnChange],
  );

  return {
    playSharedEffect,
    cardTap,
    correctGuess,
    wrongGuess,
    assassinReveal,
    gameWin,
    turnChange,
    buttonClick,
    muted,
    toggleMute,
  };
};

export default useSoundEffects;
