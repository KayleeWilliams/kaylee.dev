"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const previousPathnameRef = useRef<string | undefined>(undefined);

  // Only run entrance animation when pathname changes (navigation), not on initial mount.
  // Using a ref + useEffect keeps server and first client render identical (no hydration mismatch).
  const isInitialMount = previousPathnameRef.current === undefined;
  const isNavigation = !isInitialMount && previousPathnameRef.current !== pathname;

  useEffect(() => {
    previousPathnameRef.current = pathname;
  }, [pathname]);

  const shouldAnimateInitial = isNavigation && !shouldReduceMotion;

  return (
    <AnimatePresence mode="popLayout">
      <motion.main
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
        initial={shouldAnimateInitial ? { opacity: 0, y: 10 } : false}
        key={pathname}
        transition={{
          type: "spring",
          duration: 0.35,
          bounce: 0.15,
        }}
      >
        {children}
      </motion.main>
    </AnimatePresence>
  );
}
