"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WordCard } from "schema";
import classicWords from "./words.json";
import { getTeamColor } from "../Game/Board/getTeamColor";
import Logo from "../ui/Logo";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateBoard(): WordCard[] {
  const totalWords = 25;
  const wordsPerTeam = 8;
  const words = shuffle(classicWords).slice(0, totalWords);

  const indices = shuffle(Array.from({ length: totalWords }, (_, i) => i));
  const assassinIdx = indices.pop()!;

  const board: WordCard[] = words.map((word, i) => ({
    word,
    isAssassin: i === assassinIdx ? true : undefined,
  }));

  for (let team = 0; team < 2; team++) {
    for (let j = 0; j < wordsPerTeam; j++) {
      board[indices.pop()!].team = team;
    }
  }

  return board;
}

type Phase = "spymaster" | "operative";

type PracticeState = {
  board: WordCard[];
  currentTeam: number;
  phase: Phase;
  hint: string;
  hintCount: number;
  guessesLeft: number;
  message: string;
};

function initState(): PracticeState {
  return {
    board: generateBoard(),
    currentTeam: 0,
    phase: "spymaster",
    hint: "",
    hintCount: 0,
    guessesLeft: 0,
    message: "You're the Spymaster. Look at the board and give a hint!",
  };
}

export default function PracticeMode({ onExit }: { onExit: () => void }) {
  const [state, setState] = useState<PracticeState>(initState);
  const [hintInput, setHintInput] = useState("");
  const [countInput, setCountInput] = useState("2");
  const [gameOver, setGameOver] = useState<string | null>(null);

  const teamColor = getTeamColor(state.currentTeam);
  const otherTeamColor = getTeamColor(state.currentTeam === 0 ? 1 : 0);

  const remainingByTeam = (team: number) =>
    state.board.filter((c) => c.team === team && !c.revealed).length;

  const giveHint = useCallback(() => {
    if (!hintInput.trim()) return;
    const count = Math.max(1, Math.min(9, parseInt(countInput) || 1));
    setState((s) => ({
      ...s,
      phase: "operative",
      hint: hintInput.trim(),
      hintCount: count,
      guessesLeft: count + 1,
      message: `Hint: "${hintInput.trim()}, ${count}" — tap words to guess!`,
    }));
    setHintInput("");
    setCountInput("2");
  }, [hintInput, countInput]);

  const revealCard = useCallback(
    (word: string) => {
      if (state.phase !== "operative" || gameOver) return;

      setState((prev) => {
        const card = prev.board.find((c) => c.word === word);
        if (!card || card.revealed) return prev;

        const newBoard = prev.board.map((c) =>
          c.word === word ? { ...c, revealed: { byTeam: prev.currentTeam, inTurn: 0 } } : c
        );

        // Check assassin
        if (card.isAssassin) {
          setGameOver(`You hit the assassin! Game over.`);
          return { ...prev, board: newBoard, message: "💀 Assassin!" };
        }

        // Check if team won
        const remaining = newBoard.filter(
          (c) => c.team === prev.currentTeam && !c.revealed
        ).length;
        if (remaining === 0) {
          setGameOver(`Team ${prev.currentTeam} found all their words! 🎉`);
          return { ...prev, board: newBoard, message: "You found them all!" };
        }

        // Wrong guess
        if (card.team !== prev.currentTeam) {
          const nextTeam = prev.currentTeam === 0 ? 1 : 0;
          // Check if other team won by you revealing their last card
          const otherRemaining = newBoard.filter(
            (c) => c.team === nextTeam && !c.revealed
          ).length;
          if (otherRemaining === 0) {
            setGameOver(`Team ${nextTeam} wins — you revealed their last word!`);
            return { ...prev, board: newBoard, message: "Wrong team wins!" };
          }
          return {
            ...prev,
            board: newBoard,
            currentTeam: nextTeam,
            phase: "spymaster",
            hint: "",
            guessesLeft: 0,
            message: `Wrong! That was ${card.team !== undefined ? `Team ${card.team}'s` : "a neutral"} card. Switching to Team ${nextTeam}'s spymaster turn.`,
          };
        }

        // Correct guess
        const guessesLeft = prev.guessesLeft - 1;
        if (guessesLeft <= 0) {
          const nextTeam = prev.currentTeam === 0 ? 1 : 0;
          return {
            ...prev,
            board: newBoard,
            currentTeam: nextTeam,
            phase: "spymaster",
            hint: "",
            guessesLeft: 0,
            message: `No guesses left. Switching to Team ${nextTeam}'s spymaster turn.`,
          };
        }

        return {
          ...prev,
          board: newBoard,
          guessesLeft,
          message: `Correct! ${guessesLeft} guess${guessesLeft !== 1 ? "es" : ""} remaining.`,
        };
      });
    },
    [state.phase, gameOver]
  );

  const endTurn = useCallback(() => {
    setState((prev) => {
      const nextTeam = prev.currentTeam === 0 ? 1 : 0;
      return {
        ...prev,
        currentTeam: nextTeam,
        phase: "spymaster",
        hint: "",
        guessesLeft: 0,
        message: `Turn ended. Team ${nextTeam}'s spymaster turn.`,
      };
    });
  }, []);

  const restart = useCallback(() => {
    setState(initState());
    setGameOver(null);
  }, []);

  const showColors = state.phase === "spymaster" || !!gameOver;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-[radial-gradient(ellipse_at_center,_#2a1f48_0%,_#0f0f1a_70%)] p-4 pt-6">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-surface px-3 py-1 text-sm font-bold text-purple-300">
            Practice Mode
          </span>
          <motion.button
            className="rounded-xl border border-purple-700/30 bg-elevated px-3 py-1 text-sm font-bold text-purple-300 hover:border-accent hover:text-white"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
          >
            Exit
          </motion.button>
        </div>
      </div>

      {/* Score bar */}
      <div className="flex w-full max-w-4xl items-center justify-between gap-4">
        <div className={`flex items-center gap-2 rounded-2xl bg-gradient-to-br ${teamColor.badgeFrom} ${teamColor.badgeTo} px-4 py-2 ${state.currentTeam === 0 ? "ring-2 ring-amber-400/60" : "opacity-60"}`}>
          <span className="text-sm font-bold">Team 0</span>
          <span className="text-xl font-black">{remainingByTeam(0)}</span>
        </div>
        <motion.div
          key={state.message}
          className="flex-1 text-center text-sm font-semibold text-purple-300 md:text-base"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {state.message}
        </motion.div>
        <div className={`flex items-center gap-2 rounded-2xl bg-gradient-to-br ${otherTeamColor.badgeFrom} ${otherTeamColor.badgeTo} px-4 py-2 ${state.currentTeam === 1 ? "ring-2 ring-amber-400/60" : "opacity-60"}`}>
          <span className="text-sm font-bold">Team 1</span>
          <span className="text-xl font-black">{remainingByTeam(1)}</span>
        </div>
      </div>

      {/* Phase indicator + hint area */}
      <AnimatePresence mode="wait">
        {state.phase === "spymaster" && !gameOver && (
          <motion.div
            key="spymaster"
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <span className="rounded-xl bg-amber-400/20 px-4 py-1 text-sm font-bold text-amber-300">
              🕵️ Spymaster View — cards are visible
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="w-40 rounded-2xl border-2 border-purple-700 bg-surface px-3 py-2 font-mono font-bold text-white placeholder-purple-300/60 focus:border-accent focus:outline-none"
                placeholder="Hint word"
                value={hintInput}
                onChange={(e) => setHintInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && giveHint()}
              />
              <input
                type="number"
                className="w-16 rounded-2xl border-2 border-purple-700 bg-surface px-3 py-2 text-center font-mono font-bold text-white placeholder-purple-300/60 focus:border-accent focus:outline-none"
                min={1}
                max={9}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
              />
              <motion.button
                className="rounded-2xl bg-gradient-to-br from-primary to-accent px-6 py-2 font-bold text-white shadow-lg shadow-primary/40"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={giveHint}
              >
                Give hint
              </motion.button>
            </div>
          </motion.div>
        )}
        {state.phase === "operative" && !gameOver && (
          <motion.div
            key="operative"
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <span className="rounded-xl bg-accent/20 px-4 py-1 text-sm font-bold text-accent">
              🔍 Operative View
            </span>
            <span className="font-mono text-xl font-bold">
              {state.hint} ({state.hintCount})
            </span>
            <span className="text-sm text-purple-400">
              {state.guessesLeft} guess{state.guessesLeft !== 1 ? "es" : ""} left
            </span>
            <motion.button
              className="rounded-xl border-2 border-purple-700 bg-elevated px-4 py-1 text-sm font-bold text-accent"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={endTurn}
            >
              End turn
            </motion.button>
          </motion.div>
        )}
        {gameOver && (
          <motion.div
            key="gameover"
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="text-xl font-bold">{gameOver}</span>
            <motion.button
              className="rounded-2xl bg-gradient-to-br from-primary to-accent px-8 py-3 text-lg font-bold text-white shadow-lg shadow-primary/40"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={restart}
            >
              Play again
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      <div className={`grid w-full max-w-4xl grid-cols-5 grid-rows-5 gap-2 rounded-2xl border-8 border-solid ${getTeamColor(state.currentTeam).border} p-2`}>
        {state.board.map((card, i) => {
          const isRevealed = !!card.revealed;

          let bg = "bg-[#f5f0ff] card-shadow-default";
          let text = "text-[#1a1530]";

          if (isRevealed || showColors) {
            if (card.isAssassin) {
              bg = "bg-gradient-to-br from-red-600 to-red-400 card-shadow-assassin";
              text = "text-white";
            } else if (card.team !== undefined) {
              const c = getTeamColor(card.team);
              bg = `bg-gradient-to-br ${c.from} ${c.to} ${c.shadow}`;
              text = "text-white";
            } else {
              bg = "bg-[#3a3550] card-shadow-neutral";
              text = "text-[#8078a0]";
            }
          }

          const opacity = showColors && !isRevealed ? 0.6 : isRevealed ? 0.4 : 0.95;

          return (
            <motion.div
              key={card.word}
              className={`flex h-24 cursor-pointer flex-col items-center justify-center rounded-[14px] p-4 ${bg} ${isRevealed ? "pointer-events-none" : ""}`}
              onClick={() => revealCard(card.word)}
              whileHover={!isRevealed && state.phase === "operative" ? { scale: 1.08, y: -3 } : {}}
              whileTap={!isRevealed && state.phase === "operative" ? { scale: 0.9 } : {}}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity, y: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 15,
                delay: i * 0.02,
              }}
            >
              <p className={`text-m font-extrabold ${text} select-none text-center md:text-xl ${isRevealed ? "line-through opacity-60" : ""}`}>
                {card.word}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
