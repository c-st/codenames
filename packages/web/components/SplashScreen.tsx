import { motion } from "motion/react";
import Logo from "./ui/Logo";

export default function SplashScreen({
  onPlay,
  onLearnToPlay,
}: {
  onPlay: () => void;
  onLearnToPlay: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[radial-gradient(ellipse_at_center,_#2a1f48_0%,_#0f0f1a_70%)]">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div className="mb-4 text-5xl tracking-widest">
          🦊 🦉 🐱 🐶 🐼
        </div>
        <div className="mb-2">
          <Logo size="large" />
        </div>
        <p className="mb-10 text-lg text-purple-400/70">
          A word guessing game for clever animals
        </p>
        <div className="flex justify-center gap-4">
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
            onClick={onLearnToPlay}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            Learn to play
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
