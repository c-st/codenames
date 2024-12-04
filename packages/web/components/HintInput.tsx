import { useState } from "react";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/TextInput";

export default function HintInput({
  giveHint,
}: {
  giveHint: (hint: string, count: number) => void;
}) {
  const [hint, setHint] = useState("");

  const submitHint = () => {
    if (hint.trim() !== "") {
      giveHint(hint, 0);
      setHint("");
    }
  };

  return (
    <div className="flex gap-2">
      <TextInput
        value={hint}
        placeholder="Hint"
        onChange={setHint}
        onSubmit={submitHint}
      />
      <Button title="Give hint" onClick={submitHint} />
    </div>
  );
}
