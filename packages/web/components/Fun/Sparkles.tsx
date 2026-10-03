import { motion } from "motion/react";
import { useMemo } from "react";

/** A one-shot burst of particles flying out of a card. Mount it to play it. */
export default function Sparkles({
  color,
  count = 12,
  delay = 0,
  emoji,
}: {
  color: string;
  count?: number;
  delay?: number;
  emoji?: string;
}) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 38 + Math.random() * 40;
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: 5 + Math.random() * 6,
          spin: Math.random() * 360,
        };
      }),
    [count],
  );

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute select-none"
          style={
            emoji
              ? { fontSize: p.size * 2.2 }
              : {
                  width: p.size,
                  height: p.size,
                  borderRadius: i % 3 ? "9999px" : "2px",
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                }
          }
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: [0, 1, 0],
            scale: [0.4, 1.2, 0.6],
            rotate: p.spin,
          }}
          transition={{ duration: 0.75, delay, ease: "easeOut" }}
        >
          {emoji}
        </motion.span>
      ))}
    </span>
  );
}
