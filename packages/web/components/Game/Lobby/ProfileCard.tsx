import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Animal, Player } from "schema";
import AnimalAvatar from "@/components/ui/AnimalAvatar";
import { animalNames } from "@/components/ui/animals";
import Sparkles from "@/components/Fun/Sparkles";
import { getTeamColor } from "../Board/getTeamColor";
import { getSpymasterTitle } from "../spymasterTitle";
import AnimalPicker from "./AnimalPicker";

/** The player's own identity: a big glowing avatar, their name and the animal picker. */
export default function ProfileCard({
  player,
  others,
  setProfile,
  onRandomize,
  onSaved,
  onBecomeSpymaster,
}: {
  player: Player;
  others: Player[];
  setProfile: (name: string, animal: Animal) => void;
  onRandomize?: () => void;
  /** Called after the name form is submitted, e.g. to close a sheet. */
  onSaved?: () => void;
  onBecomeSpymaster?: () => void;
}) {
  const id = useId();
  const animal = player.animal ?? "🦊";
  const [newName, setNewName] = useState(player.name);
  useEffect(() => setNewName(player.name), [player.name]);

  // Show the pick immediately; the server's echo then confirms it.
  const [shownAnimal, setShownAnimal] = useState(animal);
  useEffect(() => setShownAnimal(animal), [animal]);
  // Sparkles celebrate a change, not the first render.
  const picks = useRef(0);

  const chooseAnimal = (next: Animal) => {
    if (next === shownAnimal) return;
    picks.current += 1;
    setShownAnimal(next);
    setProfile(player.name, next);
  };

  const isSpy = player.role === "spymaster";
  const teamColor = getTeamColor(player.team);

  return (
    <section
      aria-label="Your profile"
      className="grid w-full gap-6 md:grid-cols-[13rem_1fr] md:gap-8"
    >
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative grid place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={shownAnimal}
              className="grid"
              initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
            >
              <AnimalAvatar animal={shownAnimal} size="xl" glow crowned={isSpy} />
            </motion.span>
          </AnimatePresence>
          {picks.current > 0 && (
            <Sparkles key={picks.current} color="#ffd060" count={14} />
          )}
        </div>
        <p className="text-center" aria-live="polite">
          <span className="block text-xs font-bold uppercase tracking-[0.16em] text-purple-400">
            {animalNames[shownAnimal]}
          </span>
          <span className="text-lg font-black !text-white">
            {isSpy ? `🕵️ ${getSpymasterTitle()}` : "🔍 Operative"}
          </span>
          <span
            className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-300"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: teamColor.hex, boxShadow: `0 0 8px ${teamColor.hex}` }}
            />
            Your role
          </span>
        </p>
        {!isSpy && onBecomeSpymaster && (
          <motion.button
            type="button"
            className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-sm font-bold text-amber-200 hover:bg-amber-300/20"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onBecomeSpymaster}
          >
            👑 Become {getSpymasterTitle()}
          </motion.button>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newName.trim()) return;
            setProfile(newName.trim(), shownAnimal);
            onSaved?.();
          }}
        >
          <label
            htmlFor={`${id}-name`}
            className="text-xs font-bold uppercase tracking-[0.16em] text-purple-400"
          >
            Your name
          </label>
          <div className="flex gap-2">
            <input
              id={`${id}-name`}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={50}
              required
              placeholder="Your name"
              autoComplete="nickname"
              className="min-w-0 flex-1 rounded-2xl border border-purple-400/35 bg-base/50 px-4 py-3 text-lg font-bold text-white outline-none transition focus:border-accent focus:shadow-[0_0_0_4px_rgba(160,112,224,0.2)]"
            />
            {onRandomize && (
              <motion.button
                type="button"
                onClick={onRandomize}
                className="rounded-2xl border border-purple-400/35 bg-elevated px-3 text-xl"
                aria-label="Random name"
                whileHover={{ rotate: 25, scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
              >
                🎲
              </motion.button>
            )}
            <motion.button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-2xl bg-gradient-to-br from-primary to-accent px-4 font-bold text-white shadow-md shadow-primary/30 disabled:opacity-40 disabled:shadow-none"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              Save profile
            </motion.button>
          </div>
        </form>
        <div className="flex flex-col gap-3">
          <span
            aria-hidden="true"
            className="text-xs font-bold uppercase tracking-[0.16em] text-purple-400"
          >
            Your animal
          </span>
          <AnimalPicker value={shownAnimal} onChange={chooseAnimal} others={others} />
        </div>
        <p className="text-xs text-purple-400/80">
          Your name and animal are remembered on this browser.
        </p>
      </div>
    </section>
  );
}
