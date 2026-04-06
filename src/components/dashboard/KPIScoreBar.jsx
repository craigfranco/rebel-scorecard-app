import React from "react";
import { motion } from "framer-motion";

export default function KPIScoreBar({ label, weight, target, actual, score, maxScore, pass, delay = 0 }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-card rounded-xl p-4 border border-border"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {weight}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-foreground">{score}</span>
          <span className="text-xs text-muted-foreground">/ {maxScore}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            pass ? "bg-pass/10 text-pass" : "bg-fail/10 text-fail"
          }`}>
            {pass ? "PASS" : "FAIL"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        <span>Target: {target}</span>
        <span>·</span>
        <span>Actual: {actual}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${pass ? "bg-pass" : "bg-fail"}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}