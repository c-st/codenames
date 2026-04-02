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
        <motion.button
          className="rounded-xl bg-elevated px-3 py-3 text-lg md:py-4"
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9, rotate: 360 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          onClick={onRandomize}
          title="Random name"
        >
          🎲
        </motion.button>
      )}
    </div>
  );
}
