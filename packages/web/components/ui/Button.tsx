import { motion } from "framer-motion";

export function Button({
  title,
  onClick,
}: {
  title: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      className="flex h-12 cursor-pointer select-none items-center justify-center rounded-full bg-blue-500 p-6 text-xl font-bold"
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17,
      }}
    >
      {title}
    </motion.div>
  );
}
