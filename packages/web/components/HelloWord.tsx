"use client";

import { motion } from "framer-motion";

export default function HelloWord() {
  return (
    <>
      <motion.span
        animate={{ x: [0, -1, 1, -1, 1, 0] }}
        transition={{ duration: 0.1, repeat: Infinity, repeatType: "loop" }}
      >
        <span className="text-8xl">🚀</span>
      </motion.span>
      <p className="text-xl">hello word</p>
    </>
  );
}
