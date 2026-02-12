"use client";

import { motion } from "framer-motion";
import { Mail, ShieldCheck } from "lucide-react";

export default function VerifyLoader() {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-950">
      <div className="relative">
        {/* Outer glowing ring */}
        <motion.div
          className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Main icon container */}
        <div className="relative w-24 h-24 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-center overflow-hidden">
          <motion.div
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Mail className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </motion.div>

          {/* Progress ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <motion.circle
              cx="48"
              cy="48"
              r="45"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              className="text-blue-600/20"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="45"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              strokeDasharray="283"
              animate={{
                strokeDashoffset: [283, 0, -283],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
              className="text-blue-600"
            />
          </svg>
        </div>

        {/* Small floating shield check */}
        <motion.div
          className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full border-4 border-white dark:border-gray-950 flex items-center justify-center shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          <ShieldCheck className="w-5 h-5 text-white" />
        </motion.div>
      </div>

      <motion.div
        className="mt-8 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Securing your session
        </h2>
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-blue-600 rounded-full"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
