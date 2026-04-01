"use client";

import { useEffect, useState } from "react";

const EMOJI_LIST = ["🎉", "🎊", "✨", "⭐", "🌟", "🦊", "🦉", "🐱", "🐶", "🐼"];

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
    const newParticles: Particle[] = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      emoji: EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)],
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 1 + Math.random() * 1.5,
    }));
    setParticles(newParticles);
  }, [active]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti"
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
