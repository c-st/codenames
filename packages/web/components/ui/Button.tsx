import { motion } from "motion/react";

export function Button({
  title,
  type = "primary",
  onClick,
}: {
  title: string;
  type?: "primary" | "destructive";
  onClick?: () => void;
}) {
  return (
    <motion.div
      className={`btn ${type === "primary" ? "btn-primary" : "btn-error"} font-bold text-white md:btn-lg md:text-xl`}
      whileHover={{ scale: 1.3 }}
      whileTap={{ scale: 0.8 }}
      whileFocus={{ scale: 1.3 }}
      onClick={onClick}
      transition={{
        type: "spring",
        damping: 10,
        stiffness: 300,
      }}
    >
      {title}
    </motion.div>
  );
}
