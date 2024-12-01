import { motion } from "framer-motion";

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
      className={`flex h-12 cursor-pointer select-none items-center justify-center rounded-full ${type === "primary" ? "bg-blue-500" : "bg-red-500"} text-md bg-blue-500 p-6 font-bold text-white md:text-xl`}
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
