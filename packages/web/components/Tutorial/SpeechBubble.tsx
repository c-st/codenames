import { motion } from "motion/react";

export default function SpeechBubble({
  speaker,
  message,
}: {
  speaker: { emoji: string; name: string };
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="cursor-default select-none text-5xl"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        {speaker.emoji}
      </motion.div>
      <span className="text-sm font-bold text-purple-400">
        {speaker.name}
      </span>
      <motion.div
        className="relative max-w-md rounded-2xl border-2 border-purple-700 bg-elevated px-6 py-4 text-center text-lg leading-relaxed text-purple-100"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
      >
        <div
          className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-purple-700 bg-elevated"
        />
        {message}
      </motion.div>
    </div>
  );
}
