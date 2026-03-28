"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiArrowLeftLine } from "@remixicon/react";
import { Card, CardContent } from "@/components/base/card";
import ThemeSwitcher from "./theme-switcher";

export function Sidebar({
  profile,
  secondary,
}: {
  profile: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const isHome = pathname === "/";

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {pathname !== "/" && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-row items-center justify-center gap-4"
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20 }}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
            transition={{
              type: "spring",
              duration: 0.4,
              bounce: 0,
            }}
          >
            <ThemeSwitcher />

            <Card className="w-full transition-[background-color] duration-150 ease hover:bg-violet-50 active:scale-[0.98] dark:hover:bg-violet-500">
              <CardContent className="py-4">
                <Link
                  className="flex flex-row items-center justify-center gap-2 font-medium"
                  href="/"
                  prefetch
                >
                  <RiArrowLeftLine className="size-4" />
                  Go Back
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={isHome ? "hidden md:block" : undefined}>
        {profile}
      </div>
      {secondary ? (
        <div className={isHome ? "hidden md:block" : undefined}>
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
