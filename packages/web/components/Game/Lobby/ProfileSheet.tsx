import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Animal, Player } from "schema";
import ProfileCard from "./ProfileCard";

/** The profile editor in a softly blurred sheet over the arena. */
export default function ProfileSheet({
  open,
  onClose,
  player,
  others,
  setProfile,
  onRandomize,
  onBecomeSpymaster,
}: {
  open: boolean;
  onClose: () => void;
  player: Player;
  others: Player[];
  setProfile: (name: string, animal: Animal) => void;
  onRandomize?: () => void;
  onBecomeSpymaster?: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // Room broadcasts re-render the parent; focus must only move when the sheet opens.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="profile-sheet"
          className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-[#08060f]/60 p-3 backdrop-blur-md sm:place-items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Edit your profile"
            className="glass-panel w-full max-w-2xl p-5 md:p-7"
            initial={{ y: 60, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            <ProfileCard
              player={player}
              others={others}
              setProfile={setProfile}
              onRandomize={onRandomize}
              onSaved={onClose}
              onBecomeSpymaster={
                onBecomeSpymaster &&
                (() => {
                  onBecomeSpymaster();
                  onClose();
                })
              }
            />
            <div className="mt-5 flex justify-center">
              <motion.button
                type="button"
                className="rounded-2xl bg-elevated px-6 py-2 font-bold text-purple-100 hover:bg-purple-800/60"
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
              >
                Done
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
