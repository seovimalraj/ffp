"use client";

import { motion } from "framer-motion";

export default function VerifyLoader() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center bg-white font-sans transition-colors duration-500 dark:bg-gray-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <h2 className="text-3xl font-light tracking-widest text-gray-900 dark:text-white uppercase">
          Verifying
        </h2>

        <div className="mt-8 flex items-center justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1 w-8 rounded-full bg-blue-600 dark:bg-blue-500"
              animate={{
                scaleX: [1, 1.5, 1],
                opacity: [0.2, 1, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        <motion.p
          className="mt-6 text-sm font-medium tracking-widest text-gray-400 dark:text-gray-500 uppercase"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          Securing your session
        </motion.p>
      </motion.div>

      {/* Subtle corner gradients for premium feel without clutter */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-indigo-500/5 blur-[100px]" />
      </div>
    </div>
  );
}
