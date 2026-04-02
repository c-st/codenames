import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { useState } from "react";

export default function HintInput({
  giveHint,
}: {
  giveHint: (hint: string, count: number) => void;
}) {
  const [hint, setHint] = useState("");
  const [count, setCount] = useState("2");

  const submitHint = () => {
    if (hint.trim() !== "") {
      const num = Math.max(0, Math.min(9, parseInt(count) || 0));
      giveHint(hint, num);
      setHint("");
      setCount("2");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <TextInput
        value={hint}
        placeholder="Hint word"
        onChange={setHint}
        onSubmit={submitHint}
      />
      <input
        type="number"
        className="w-14 rounded-2xl border-2 border-purple-700 bg-surface px-2 py-3 text-center font-mono font-bold text-white focus:border-accent focus:outline-none md:py-4"
        min={0}
        max={9}
        value={count}
        onChange={(e) => setCount(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitHint()}
      />
      <Button title="Give hint" onClick={submitHint} />
    </div>
  );
}
