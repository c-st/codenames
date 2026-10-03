import { motion } from "motion/react";
import { TextInput } from "@/components/ui/TextInput";
import { useEffect, useRef, useState } from "react";

const TYPING_REFRESH_MS = 2000;

export default function HintInput({
  giveHint,
  onTyping,
}: {
  giveHint: (hint: string, count: number) => void;
  onTyping?: (typing: boolean) => void;
}) {
  const [hint, setHint] = useState("");
  const [count, setCount] = useState("2");
  const lastTypingSignal = useRef(0);

  // Tell the room the spymaster is thinking; refreshed while typing, cleared when done.
  const updateHint = (value: string) => {
    setHint(value);
    const now = Date.now();
    if (!value.trim()) {
      lastTypingSignal.current = 0;
      onTyping?.(false);
    } else if (now - lastTypingSignal.current > TYPING_REFRESH_MS) {
      lastTypingSignal.current = now;
      onTyping?.(true);
    }
  };
  useEffect(() => () => onTyping?.(false), [onTyping]);

  const submitHint = () => {
    if (hint.trim() !== "") {
      const num = Math.max(0, Math.min(9, parseInt(count) || 0));
      giveHint(hint, num);
      lastTypingSignal.current = 0;
      setHint("");
      setCount("2");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TextInput
        value={hint}
        placeholder="Hint word"
        onChange={updateHint}
        onSubmit={submitHint}
      />
      <input
        type="number"
        className="w-14 rounded-xl border-2 border-purple-700 bg-surface px-2 py-3 text-center font-mono font-bold text-white focus:border-accent focus:outline-none md:py-4"
        min={0}
        max={9}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitHint()}
      />
      <motion.button
        className="rounded-xl bg-gradient-to-br from-primary to-accent px-4 py-3 text-sm font-bold text-white shadow-md shadow-primary/30 md:py-4"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={submitHint}
      >
        Give hint
      </motion.button>
    </div>
  );
}
