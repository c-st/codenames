import { useEffect, useState } from "react";
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
    <div className="flex flex-col gap-4">
      Turn: team {turn.team}
      <Timer until={until} />
      <WordMatrix words={words} />
    </div>
  );
}

function Timer({ until }: { until: Date }) {
  const [timeLeft, setTimeLeft] = useState({ minutes: "", seconds: "" });

  useEffect(() => {
    const timer = setInterval(() => {
      const difference = +new Date(until) - +new Date();
      let timeLeft = {
        minutes: "0",
        seconds: "00",
      };
      if (difference > 0) {
        timeLeft = {
          minutes: Math.floor((difference / (1000 * 60)) % 60).toString(),
          seconds: Math.floor((difference / 1000) % 60)
            .toString()
            .padStart(2, "0"),
        };
      }
      setTimeLeft(timeLeft);
    }, 1000);

    return () => clearInterval(timer);
  }, [until]);

  return (
    <div className="flex justify-end">
      <span className="font-mono text-2xl">
        {timeLeft.minutes}:{timeLeft.seconds}
      </span>
    </div>
  );
}

function WordMatrix({ words }: { words: WordCard[] }) {
  return (
    <div className="grid grid-cols-5 grid-rows-5 gap-2">
      {words.map((wordCard) => (
        <div
          key={wordCard.word}
          className="flex items-center justify-center p-4 border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 font-mono font-bold"
        >
          {wordCard.word}
        </div>
      ))}
    </div>
  );
}
