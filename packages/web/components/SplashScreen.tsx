import { useMemo, useState } from "react";
import { motion } from "motion/react";
import Logo from "./ui/Logo";

const allAnimals = [
  "🦊", "🦉", "🐱", "🐶", "🐼", "🐰", "🐨", "🦝",
  "🐻", "🦦", "🐧", "🦎", "🐸", "🐬", "🦒", "🦅",
  "🐯", "🦁", "🐮", "🐷", "🐵", "🦄", "🐲", "🦋",
];

function pickRandom(arr: string[], count: number): string[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export default function SplashScreen({
  onPlay,
  onLearnToPlay,
  onPractice,
}: {
  onPlay: () => void;
  onLearnToPlay: () => void;
  onPractice: () => void;
}) {
  const emojis = useMemo(() => pickRandom(allAnimals, 5), []);
  const [showImprint, setShowImprint] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,_#2a1f48_0%,_#0f0f1a_70%)]">
      <div className="text-center">
        <div className="mb-4 flex justify-center gap-3">
          {emojis.map((emoji, i) => (
            <motion.span
              key={emoji}
              className="text-5xl"
              initial={{ opacity: 0, y: -30, scale: 0 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 15,
                delay: 0.1 + i * 0.08,
              }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
        <motion.div
          className="mb-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.5 }}
        >
          <Logo size="large" />
        </motion.div>
        <motion.p
          className="mb-10 text-lg text-purple-400/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          A word guessing game for clever animals
        </motion.p>
        <motion.div
          className="flex justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.9 }}
        >
          <motion.button
            className="rounded-2xl bg-gradient-to-br from-primary to-accent px-12 py-4 text-xl font-bold text-white shadow-lg shadow-primary/40"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPlay}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            Play
          </motion.button>
          <motion.button
            className="rounded-2xl border-2 border-purple-700 bg-elevated px-8 py-4 text-xl font-bold text-accent"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPractice}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            Practice solo
          </motion.button>
          <motion.button
            className="rounded-2xl border-2 border-purple-700 bg-elevated px-8 py-4 text-xl font-bold text-accent"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLearnToPlay}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            Learn to play
          </motion.button>
        </motion.div>
        <button
          className="mt-12 text-xs text-purple-500/40 transition-colors hover:text-purple-400"
          onClick={() => setShowImprint((s) => !s)}
        >
          Impressum
        </button>
        {showImprint && (
          <div className="mt-2 max-w-xs text-center text-xs leading-relaxed text-purple-400/60">
            Christian Stangier · Ulzburger Str. 48d · 22850 Norderstedt, Germany ·{" "}
            <a href="mailto:christian@stangier.email" className="underline hover:text-purple-300">
              christian@stangier.email
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
