import { useRef } from "react";
import { motion } from "motion/react";
import { Animal, animalSchema, Player } from "schema";
import { animalNames } from "@/components/ui/animals";

/**
 * The animals as a grid of glowing tiles. Choosing one applies it straight away.
 * Animals other players already have stay pickable, but show who has them.
 */
export default function AnimalPicker({
  value,
  onChange,
  others,
}: {
  value?: Animal;
  onChange: (animal: Animal) => void;
  /** Everyone else in the room, to show who already has which animal. */
  others: Player[];
}) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const animals = animalSchema.options;
  const selectedIndex = Math.max(0, animals.indexOf(value ?? "🦊"));

  // One tab stop for the whole group; arrows move and choose, like native radios.
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | undefined;
    if (event.key in step)
      next = (index + step[event.key] + animals.length) % animals.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = animals.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tiles.current[next]?.focus();
    onChange(animals[next]);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Your animal"
      className="grid grid-cols-4 gap-2 sm:grid-cols-8"
    >
      {animals.map((animal, index) => {
        const selected = index === selectedIndex;
        const holders = others.filter((p) => p.animal === animal);
        const holderNames = holders.map((p) => p.name).join(", ");
        return (
          <motion.button
            key={animal}
            ref={(el) => {
              tiles.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${animalNames[animal]}${holders.length ? `, also chosen by ${holderNames}` : ""}`}
            title={animalNames[animal]}
            tabIndex={selected ? 0 : -1}
            className={`relative grid aspect-square place-items-center rounded-2xl border bg-gradient-to-br from-[#2f2452] to-[#1d1736] text-3xl transition-[box-shadow,border-color] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected
                ? "ring-spin border-transparent shadow-[0_0_22px_rgba(255,208,96,0.45),inset_0_0_18px_rgba(255,208,96,0.12)]"
                : "border-purple-400/20 hover:border-purple-400/60 hover:shadow-[0_10px_24px_-6px_rgba(160,112,224,0.6)]"
            }`}
            animate={{ scale: selected ? 1.06 : 1 }}
            whileHover={{ y: -3, scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            onClick={() => onChange(animal)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span aria-hidden="true" className="select-none">
              {animal}
            </span>
            {holders.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute -bottom-1.5 left-1/2 max-w-[110%] -translate-x-1/2 truncate rounded-lg border border-purple-400/35 bg-base/90 px-1.5 text-[0.6rem] font-bold leading-4 text-purple-200"
              >
                {holderNames}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
