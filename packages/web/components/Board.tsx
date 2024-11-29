import { Turn, WordCard } from "schema";

export default function Board({
  words,
  turn,
}: {
  words?: WordCard[];
  turn: Turn;
}) {
  const { until } = turn;

  if (words === undefined) {
    return null;
  }

  words.map((w) => w.word);

  return (
    <div>
      Board. {words.map((w) => w.word + "\n")} Round until {until.toISOString()}
    </div>
  );
}
