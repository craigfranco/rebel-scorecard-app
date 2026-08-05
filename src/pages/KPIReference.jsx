import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Target, TrendingUp, BarChart3, Star, Zap, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GSS_TARGETS } from "@/lib/scoring";

const measures = [
  {
    name: "Budgeted GOP",
    weight: "35%",
    maxPts: 35,
    target: "100%+ of budgeted GOP",
    scoring: "Score = (Actual GOP / Target GOP) × 35, capped at 35 pts",
    passRule: "≥ 100% of budgeted GOP achieved",
    icon: Target,
  },
  {
    name: "GOP Margin Improvement",
    weight: "35%",
    maxPts: 35,
    target: "Any improvement above prior year margin (> 0)",
    scoring: "Binary pass/fail: any positive improvement vs prior year = 35 pts. No improvement = 0 pts",
    passRule: "GOP margin improvement > 0 vs prior year",
    icon: TrendingUp,
  },
  {
    name: "RGI Improvement",
    weight: "15%",
    maxPts: 15,
    target: "≥ 0.1% improvement vs prior year",
    scoring: "0.1%–2.0% improvement = 7.5 pts (partial). ≥ 2.1% = 15 pts (full). Below 0.1% = 0 pts",
    passRule: "Any improvement ≥ 0.1% is a pass",
    icon: BarChart3,
  },
  {
    name: "GSS Improvement",
    weight: "15%",
    maxPts: 15,
    target: "YOY improvement per brand standard",
    scoring: "Score = (Improvement / Brand Target) × 15, capped at 15 pts",
    passRule: "Meet or exceed brand-specific GSS improvement target",
    icon: Star,
  },
];

const gssEntries = Object.entries(GSS_TARGETS);

export default function KPIReference() {
  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight">KPI Reference</h1>
            <p className="text-sm text-muted-foreground mt-0.5">2026 Incentive Plan — Scoring Methodology</p>
          </div>
        </div>
      </motion.div>

      {/* Score Calculation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl border border-border p-6"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">How the Score is Calculated</h2>
        <div className="bg-muted/50 rounded-xl p-4 font-mono text-sm space-y-1">
          <p><span className="text-primary font-bold">Total Score</span> = GOP pts + Margin pts + RGI pts + GSS pts</p>
          <p><span className="text-muted-foreground">Range:</span> 0–100 points</p>
          <p className="pt-2"><span className="text-pass font-bold">PASS</span> = Score ≥ 70</p>
          <p><span className="text-fail font-bold">FAIL</span> = Score &lt; 70</p>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Kickers (Forecast Accuracy & Red Zone) are additive bonuses shown separately and do not count toward the base 0–100 score.
        </p>
      </motion.div>

      {/* KPI Details */}
      <div className="space-y-4">
        {measures.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <m.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{m.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs font-semibold">Weight: {m.weight}</Badge>
                    <Badge variant="outline" className="text-xs">Max: {m.maxPts} pts</Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Target</p>
                <p className="text-foreground">{m.target}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Scoring</p>
                <p className="text-foreground">{m.scoring}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pass Rule</p>
                <p className="text-foreground">{m.passRule}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Kickers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-2xl border border-border p-6"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">Kicker Bonuses</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Forecast Accuracy Kicker</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              +3% of salary bonus if 3 of 4 quarterly forecasts fall within ±3% of actual revenue. 
              Tracked as Hit/Miss per quarter.
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Red Zone Kicker</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              +25% of GSS payout bonus if the property exits and stays out of Red Zone status. 
              Tracked as Hit/Miss.
            </p>
          </div>
        </div>
      </motion.div>

      {/* GSS Brand Targets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-card rounded-2xl border border-border p-6"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">Brand-Specific GSS Targets</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {gssEntries.map(([key, val]) => (
            <div key={key} className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">{key}</p>
              <p className="text-sm font-bold text-foreground mt-1">{val.metric}</p>
              <p className="text-xs text-primary font-semibold mt-0.5">+{val.target}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}