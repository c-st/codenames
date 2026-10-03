import { AnimatePresence, motion } from "motion/react";

/** A brief full-screen colour wash, used when the assassin strikes. */
export default function ScreenFlash({
  flashId,
  lastFlashId,
}: {
  flashId?: string;
  lastFlashId?: string;
}) {
  return (
    <div className="contents" data-last-flash-id={lastFlashId}>
      <AnimatePresence>
        {flashId && (
          <motion.div
            key={flashId}
            data-testid="assassin-flash"
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-red-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.15, 0.35, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, times: [0, 0.1, 0.35, 0.5, 1] }}
          >
            <motion.span
              className="select-none text-[10rem] drop-shadow-2xl"
              initial={{ scale: 0.2, rotate: -20 }}
              animate={{
                scale: [0.2, 1.4, 1.1],
                rotate: [-20, 8, 0],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.1 }}
            >
              💀
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
