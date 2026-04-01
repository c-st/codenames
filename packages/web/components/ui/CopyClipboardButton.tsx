import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useState } from "react";

export default function CopyClipboardButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    onClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-xl bg-elevated p-2 text-accent/70 transition-colors hover:text-accent"
      >
        <AnimatePresence initial={false}>
          <MotionConfig
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              bounce: 0.8,
              duration: 0.4,
            }}
          >
            {copied ? (
              <motion.div
                className="absolute"
                key="success"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                <SuccessIcon />
              </motion.div>
            ) : (
              <motion.div
                className="absolute"
                key="clipboard"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
              >
                <ClipboardIcon />
              </motion.div>
            )}
          </MotionConfig>
        </AnimatePresence>
      </button>
    </>
  );
}

const SuccessIcon = () => (
  <svg
    className="h-3.5 w-3.5 text-emerald-400"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 16 12"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M1 5.917 5.724 10.5 15 1.5"
    />
  </svg>
);

const ClipboardIcon = () => (
  <svg
    className="h-3.5 w-3.5"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 18 20"
  >
    <path d="M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z" />
  </svg>
);
