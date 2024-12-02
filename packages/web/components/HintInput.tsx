import { useState } from "react";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/TextInput";

export default function HintInput({
  giveHint,
}: {
  giveHint: (hint: string, count: number) => void;
}) {
  const [hint, setHint] = useState("");

  return (
    <div className="flex gap-2">
      <TextInput value={hint} placeholder="Hint" onChange={setHint} />
      <Button
        title="Give hint"
        onClick={() => {
          giveHint(hint, 0);
          setHint("");
        }}
      />
    </div>
  );
}
