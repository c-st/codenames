import { motion } from "motion/react";
import { CardState } from "./tutorialSteps";

export default function TutorialBoard({
  cards,
  highlightWords,
  onTapCard,
}: {
  cards: CardState[];
  highlightWords?: string[];
  onTapCard: (word: string) => void;
}) {
  return (
    <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
      {cards.map((card) => {
        const isHighlighted = highlightWords?.includes(card.word);
        const isRevealed = card.revealed;

        let bg = "bg-[#f5f0ff] card-shadow-default";
        let text = "!text-[#1a1530]";

        if (isRevealed) {
          if (card.isAssassin) {
            bg = "bg-gradient-to-br from-red-600 to-red-400 card-shadow-assassin";
            text = "!text-white";
          } else if (card.team === "player") {
            bg = "bg-gradient-to-br from-purple-500 to-purple-300 card-shadow-purple";
            text = "!text-white";
          } else if (card.team === "opponent") {
            bg = "bg-gradient-to-br from-emerald-500 to-emerald-300 card-shadow-emerald";
            text = "!text-white";
          } else {
            bg = "bg-[#3a3550] card-shadow-neutral";
            text = "!text-[#8078a0]";
          }
        }

        return (
          <motion.div
            key={card.word}
            className={`flex items-center justify-center rounded-[14px] p-5 font-bold select-none ${isRevealed ? "cursor-default" : "cursor-pointer"} ${bg} ${text} ${isHighlighted && !isRevealed ? "ring-2 ring-accent ring-offset-2 ring-offset-base" : ""}`}
            whileHover={!isRevealed ? { scale: 1.08, y: -3 } : {}}
            whileTap={!isRevealed ? { scale: 0.9 } : {}}
            onClick={() => !isRevealed && onTapCard(card.word)}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            {card.word}
          </motion.div>
        );
      })}
    </div>
  );
}
