import { useEffect, useState } from "react";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/TextInput";

export default function NameInput({
  name,
  setName,
}: {
  name: string;
  setName: (name: string) => void;
}) {
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setNewName(name);
  }, [name]);

  return (
    <div className="flex gap-2">
      <TextInput
        value={newName}
        placeholder="Hint"
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
    </div>
  );
}
