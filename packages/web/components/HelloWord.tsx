"use client";

import { motion } from "framer-motion";

export default function HelloWord() {
  return (
    <div className="flex flex-col items-center">
      {/* <div> */}
      <motion.span
        animate={{ x: [0, -1, 1, -1, 1, 0] }}
        transition={{ duration: 0.1, repeat: Infinity, repeatType: "loop" }}
      >
        <span className="text-6xl">🚀</span>
      </motion.span>
      <motion.p
        className="text-2xl"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
        }}
      >
        hello word
      </motion.p>
      {/* </div> */}
    </div>
  );
}
