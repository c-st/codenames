import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button } from "../../ui/Button";
import { TextInput } from "../../ui/TextInput";

export default function NameInput({
  name,
  setName,
  onRandomize,
}: {
  name: string;
  setName: (name: string) => void;
  onRandomize?: () => void;
}) {
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setNewName(name);
  }, [name]);

  return (
    <div className="flex items-center gap-2">
      <TextInput
        value={newName}
        placeholder="Your name"
        onChange={setNewName}
        onSubmit={() => {
          setName(newName);
        }}
      />
      <Button
        title="Set"
        onClick={() => {
          setName(newName);
        }}
      />
      {onRandomize && (
        <button
          className="rounded-xl bg-elevated px-3 py-3 text-lg hover:bg-purple-800/50 md:py-4"
          onClick={onRandomize}
          title="Random name"
        >
          <motion.span
            className="inline-block"
            whileHover={{ rotate: 180, scale: 1.2 }}
            whileTap={{ rotate: 360, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            🎲
          </motion.span>
        </button>
      )}
    </div>
  );
}
