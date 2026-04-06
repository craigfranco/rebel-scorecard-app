import React from "react";
import { motion } from "framer-motion";
import { Zap, Shield } from "lucide-react";

export default function KickerPills({ forecastKicker, redZoneKicker }) {
  return (
    <div className="flex flex-wrap gap-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${
          forecastKicker
            ? "bg-pass/10 border-pass/30 text-pass"
            : "bg-muted border-border text-muted-foreground"
        }`}
      >
        <Zap className="w-4 h-4" />
        <span>Forecast Accuracy</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          forecastKicker ? "bg-pass/20 text-pass" : "bg-muted-foreground/10 text-muted-foreground"
        }`}>
          {forecastKicker ? "HIT" : "MISS"}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.9 }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold ${
          redZoneKicker
            ? "bg-pass/10 border-pass/30 text-pass"
            : "bg-muted border-border text-muted-foreground"
        }`}
      >
        <Shield className="w-4 h-4" />
        <span>Red Zone</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          redZoneKicker ? "bg-pass/20 text-pass" : "bg-muted-foreground/10 text-muted-foreground"
        }`}>
          {redZoneKicker ? "HIT" : "MISS"}
        </span>
      </motion.div>
    </div>
  );
}