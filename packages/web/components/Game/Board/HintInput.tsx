import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { useState } from "react";

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
