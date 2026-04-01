import { motion } from "motion/react";

export function Button({
  title,
  type = "primary",
  onClick,
}: {
  title: string;
  type?: "primary" | "secondary" | "destructive";
  onClick?: () => void;
}) {
  const styles = {
    primary:
      "bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50",
    secondary:
      "bg-elevated border-2 border-purple-700 text-accent hover:border-accent hover:bg-purple-900/50",
    destructive:
      "bg-gradient-to-br from-red-600 to-red-500 text-white shadow-lg shadow-red-600/30 hover:shadow-xl hover:shadow-red-600/40",
  };

  return (
    <motion.button
      className={`rounded-2xl px-6 py-3 text-lg font-bold md:px-8 md:py-4 md:text-xl ${styles[type]}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      transition={{
        type: "spring",
        damping: 15,
        stiffness: 300,
      }}
    >
      {title}
    </motion.button>
  );
}
