"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { tutorialSteps, tutorialCharacters } from "./tutorialSteps";
import SpeechBubble from "./SpeechBubble";
import TutorialBoard from "./TutorialBoard";
import Logo from "../ui/Logo";

export default function Tutorial({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = tutorialSteps[stepIndex];
  const isLastStep = stepIndex === tutorialSteps.length - 1;

  const advance = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  const handleTapCard = (word: string) => {
    if (step.expectedTap && word === step.expectedTap) {
      advance();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-[radial-gradient(ellipse_at_center,_#1a1838_0%,_#0f0f1a_70%)] p-4 pt-6 font-[family-name:var(--font-quicksand)]">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-surface px-3 py-1 text-sm font-bold text-purple-300">
            Tutorial
          </span>
          <motion.button
            className="rounded-xl border border-purple-700/30 bg-elevated px-3 py-1 text-sm font-bold text-purple-300 hover:border-accent hover:text-white"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onComplete}
          >
            Exit
          </motion.button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <SpeechBubble speaker={step.speaker} message={step.message} />

            <TutorialBoard
              cards={step.board}
              highlightWords={step.highlightWords}
              onTapCard={handleTapCard}
            />

            <div className="flex cursor-default select-none items-center gap-3">
              <div className="text-3xl">{tutorialCharacters.player.emoji}</div>
              <span className="text-xs font-semibold text-purple-400">You</span>
              <div className="text-3xl">{tutorialCharacters.teammate.emoji}</div>
              <span className="text-xs font-semibold text-purple-400">
                Teammate {tutorialCharacters.teammate.name}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>

        {step.autoAdvance && (
          <motion.button
            className="rounded-2xl bg-gradient-to-br from-primary to-accent px-8 py-3 text-lg font-bold text-white shadow-lg shadow-primary/40"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={advance}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isLastStep ? "Start playing!" : "Continue"}
          </motion.button>
        )}

        {/* Step progress dots */}
        <div className="flex gap-2">
          {tutorialSteps.map((_, i) => (
            <div
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i === stepIndex ? "bg-accent" : "bg-purple-800"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
