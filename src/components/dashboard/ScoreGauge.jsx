import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function ScoreGauge({ score, pass }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const strokeColor = pass ? "#4CAF50" : "#ef4444";
  const bgStroke = pass ? "#4CAF5020" : "#ef444420";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-48 h-48">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100" cy="100" r={radius}
            fill="none"
            stroke={bgStroke}
            strokeWidth="12"
          />
          <motion.circle
            cx="100" cy="100" r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-5xl font-black text-foreground"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {Math.round(score)}
          </motion.span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
            out of 100
          </span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className={`mt-4 px-6 py-2 rounded-full text-sm font-bold tracking-wide ${
          pass ? "bg-pass/10 text-pass border border-pass/30" : "bg-fail/10 text-fail border border-fail/30"
        }`}
      >
        {pass ? "PASS" : "FAIL"}
      </motion.div>
    </div>
  );
}