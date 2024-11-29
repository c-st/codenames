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
      className="flex items-center justify-center text-xl font-bold p-6 h-12 bg-blue-500 rounded-full cursor-pointer select-none"
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
