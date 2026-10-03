import { useEffect, useId, useState } from "react";
import { animalSchema, Animal } from "schema";

export default function NameInput({
  name,
  animal = "🦊",
  setProfile,
  onRandomize,
}: {
  name: string;
  animal?: Animal;
  setProfile: (name: string, animal: Animal) => void;
  onRandomize?: () => void;
}) {
  const id = useId();
  const [newName, setNewName] = useState(name);
  const [newAnimal, setNewAnimal] = useState(animal);
  useEffect(() => {
    setNewName(name);
    setNewAnimal(animal);
  }, [name, animal]);
  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (newName.trim()) setProfile(newName.trim(), newAnimal);
      }}
    >
      <label className="sr-only" htmlFor={`${id}-name`}>
        Your name
      </label>
      <input
        id={`${id}-name`}
        value={newName}
        onChange={(event) => setNewName(event.target.value)}
        maxLength={50}
        required
        placeholder="Your name"
        autoComplete="nickname"
        className="rounded-xl border border-purple-700 bg-elevated px-4 py-3 text-white focus:border-accent"
      />
      <label htmlFor={`${id}-animal`} className="text-sm text-purple-300">
        Your animal
      </label>
      <select
        id={`${id}-animal`}
        value={newAnimal}
        onChange={(event) => setNewAnimal(event.target.value as Animal)}
        className="rounded-xl border border-purple-700 bg-elevated px-4 py-2 text-xl text-white"
      >
        {animalSchema.options.map((emoji) => (
          <option key={emoji} value={emoji}>
            {emoji}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!newName.trim()}
          className="rounded-xl bg-primary px-4 py-2 font-semibold text-white disabled:opacity-40"
        >
          Save profile
        </button>
        {onRandomize && (
          <button
            type="button"
            onClick={onRandomize}
            className="rounded-xl bg-elevated px-3 py-2"
            aria-label="Random name"
          >
            🎲
          </button>
        )}
      </div>
      <p className="text-xs text-purple-400">
        Your name and animal are remembered on this browser.
      </p>
    </form>
  );
}
