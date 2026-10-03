"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Celebration } from "./hooks/useCodenames";

const PARTY_EMOJIS = ["🎉", "🎊", "✨", "⭐", "🌟", "🥳", "🏆", "👏", "🙌", "🦊", "🦉", "🐱", "🐶", "🐼", "🐰", "🦝", "🐻"];
const SAD_EMOJIS = ["💧", "💧", "💧", "😭", "🥲", "💧"];

type Particle = {
  id: number;
  content: string;
  color?: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
  wobble: number;
};

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function partyParticles(teamColor: string): Particle[] {
  // Mostly team-coloured paper with a sprinkle of emoji, in two bursts.
  return Array.from({ length: 70 }, (_, i) => {
    const late = i >= 40;
    const isEmoji = i % 4 === 0;
    return {
      id: i,
      content: isEmoji ? pick(PARTY_EMOJIS) : "",
      color: isEmoji ? undefined : pick([teamColor, teamColor, "#fde047", "#ffffff"]),
      left: Math.random() * 100,
      delay: (late ? 1.4 : 0) + Math.random(),
      duration: 2.2 + Math.random() * 2.8,
      size: isEmoji ? 1 + Math.random() * 1.4 : 0.5 + Math.random() * 0.5,
      wobble: -60 + Math.random() * 120,
    };
  });
}

function rainParticles(): Particle[] {
  return Array.from({ length: 36 }, (_, i) => ({
    id: i,
    content: pick(SAD_EMOJIS),
    left: 10 + Math.random() * 80,
    delay: 0.4 + Math.random() * 3,
    duration: 1.4 + Math.random() * 1.2,
    size: 0.9 + Math.random() * 0.8,
    wobble: -10 + Math.random() * 20,
  }));
}

/** Winners get a team-coloured confetti storm; losers get their own little rain cloud. */
export default function Confetti({ celebration, teamColor }: { celebration?: Celebration; teamColor: string }) {
  const reduceMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!celebration || reduceMotion) {
      setParticles([]);
      return;
    }
    setParticles(celebration === "win" ? partyParticles(teamColor) : rainParticles());
    const timer = setTimeout(() => setParticles([]), 7000);
    return () => clearTimeout(timer);
  }, [celebration, reduceMotion, teamColor]);

  if (!celebration || reduceMotion || particles.length === 0) return null;

  return (
    <div aria-hidden="true" data-celebration={celebration} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {celebration === "lose" && (
        <motion.div
          className="absolute left-1/2 top-4 -translate-x-1/2 select-none text-8xl"
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: [-120, 0, 0, -120], opacity: [0, 1, 1, 0], x: [0, -10, 10, -6, 0] }}
          transition={{ duration: 6, times: [0, 0.1, 0.85, 1] }}
        >
          🌧️
        </motion.div>
      )}
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
            ...(p.color ? { width: `${p.size}rem`, height: `${p.size * 0.45}rem`, background: p.color, borderRadius: 2 } : {}),
          }}
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}
