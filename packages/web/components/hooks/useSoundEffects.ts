import { useCallback, useRef } from "react";

type OscillatorType = "sine" | "square" | "triangle" | "sawtooth";

const useSoundEffects = () => {
  const ctxRef = useRef<AudioContext | null>(null);

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
      delay: number = 0
    ) => {
      const ctx = getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + delay + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    },
    [getCtx]
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

  return {
    cardTap,
    correctGuess,
    wrongGuess,
    assassinReveal,
    gameWin,
    turnChange,
    buttonClick,
  };
};

export default useSoundEffects;
