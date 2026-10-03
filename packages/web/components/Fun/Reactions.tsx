import { AnimatePresence, motion } from "motion/react";
import { Player, ReactionEmoji, reactionEmojiSchema } from "schema";
import type { Reaction } from "../hooks/useCodenames";

/** Stable pseudo-random horizontal lane per reaction, so re-renders don't make it jump. */
const laneFor = (id: string) => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return 8 + (Math.abs(hash) % 84);
};

export function ReactionBar({
  onReact,
}: {
  onReact: (emoji: ReactionEmoji) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Send a reaction"
      className="flex flex-wrap justify-center gap-1 rounded-2xl bg-surface/70 p-1.5 backdrop-blur"
    >
      {reactionEmojiSchema.options.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          aria-label={`React ${emoji}`}
          className="rounded-xl px-2 py-1 text-xl hover:bg-elevated md:text-2xl"
          whileHover={{ scale: 1.25, rotate: -8 }}
          whileTap={{ scale: 0.8 }}
          onClick={() => onReact(emoji)}
        >
          {emoji}
        </motion.button>
      ))}
    </div>
  );
}

/** Everyone's reactions bubble up from the bottom of the screen with the sender's animal. */
export function FloatingReactions({
  reactions,
  players,
}: {
  reactions: Reaction[];
  players: Player[];
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
    >
      <AnimatePresence>
        {reactions.map((reaction) => {
          const player = players.find((p) => p.id === reaction.playerId);
          const drift =
            (laneFor(reaction.id + "x") % 2 ? 1 : -1) *
            (20 + (laneFor(reaction.id) % 30));
          return (
            <motion.div
              key={reaction.id}
              data-testid="floating-reaction"
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${laneFor(reaction.id)}%` }}
              initial={{ y: 40, opacity: 0, scale: 0.4 }}
              animate={{
                y: "-55vh",
                x: [0, drift, -drift / 2, drift / 3],
                opacity: [0, 1, 1, 0],
                scale: [0.4, 1.3, 1, 0.9],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
            >
              <span className="select-none text-5xl drop-shadow-lg">
                {reaction.emoji}
              </span>
              {player && (
                <span className="mt-1 max-w-28 truncate rounded-full bg-black/40 px-2 py-0.5 text-xs font-semibold !text-white">
                  {player.animal ?? "🐾"} {player.name}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
