"use client";

import { useEffect, useState } from "react";

const EMOJI_LIST = ["✨", "⭐", "🌟", "🎉"];

type Particle = {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
};

export default function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    const newParticles: Particle[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      emoji: EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)],
      left: 10 + Math.random() * 80,
      delay: Math.random() * 1.5,
      duration: 2.5 + Math.random() * 2,
      size: 0.8 + Math.random() * 1,
    }));
    setParticles(newParticles);

    // Clear after animation completes
    const timer = setTimeout(() => setParticles([]), 5000);
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
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}
