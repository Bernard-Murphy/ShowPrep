"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fade_down, fade_up, normalize, transition_fast } from "@/lib/transitions";

type StreamingProgressMessageProps = {
  messageKey: string;
  className?: string;
  children: ReactNode;
};

export function StreamingProgressMessage({
  messageKey,
  className,
  children,
}: StreamingProgressMessageProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={messageKey}
        initial={fade_down}
        animate={normalize}
        exit={fade_up}
        transition={transition_fast}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
