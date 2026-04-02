"use client";

import { useEffect, useState } from "react";

const EMOJI_LIST = [
  "🎉", "🎊", "✨", "⭐", "🌟", "💫", "🥳", "🏆", "👏", "🙌",
  "🦊", "🦉", "🐱", "🐶", "🐼", "🐰", "🦝", "🐻",
  "💜", "💚", "🎯", "🎪", "🎭", "🎨",
];

type Particle = {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  wobble: number;
};

export default function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    // Two bursts — one immediate, one delayed
    const burst1: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      emoji: EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)],
      left: Math.random() * 100,
      delay: Math.random() * 1,
      duration: 2 + Math.random() * 3,
      size: 1 + Math.random() * 1.5,
      wobble: -30 + Math.random() * 60,
    }));

    const burst2: Particle[] = Array.from({ length: 20 }, (_, i) => ({
      id: i + 30,
      emoji: EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)],
      left: Math.random() * 100,
      delay: 1.5 + Math.random() * 1,
      duration: 2.5 + Math.random() * 2.5,
      size: 0.8 + Math.random() * 1.2,
      wobble: -40 + Math.random() * 80,
    }));

    setParticles([...burst1, ...burst2]);

    const timer = setTimeout(() => setParticles([]), 7000);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti select-none"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            fontSize: `${p.size}rem`,
            ["--wobble" as string]: `${p.wobble}px`,
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}
