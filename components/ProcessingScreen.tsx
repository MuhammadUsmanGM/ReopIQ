"use client";

import React from "react";
import { CheckCircle2, CircleDashed, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type StepStatus = "waiting" | "processing" | "complete" | "error";

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;  // Sub-step detail like skip reasons
}

interface ProcessingScreenProps {
  steps: Step[];
  progress: number;
  repoName: string;
}

export function ProcessingScreen({ steps, progress, repoName }: ProcessingScreenProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4 md:px-0 animate-in fade-in duration-1000">
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-8 border border-primary/20 shadow-sm shadow-primary/5">
        <CircleDashed size={14} className="animate-spin" />
        Neural Synchronization In Progress
      </div>

      <h2 className="text-2xl sm:text-5xl font-display text-center mb-12 tracking-tight text-foreground/90 break-words px-4">
        {repoName}
      </h2>

      {/* Progress Bar - Large & Professional */}
      <div className="w-full mb-16 relative">
        <div className="flex justify-between items-end mb-4">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-50">Global Neural Alignment</span>
          <span className="text-3xl font-display text-primary tracking-tighter">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 w-full bg-white/[0.03] dark:bg-black/40 rounded-full border border-white/[0.05] overflow-hidden backdrop-blur-sm">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-primary via-amber-400 to-primary transition-all duration-700 ease-out"
          />
        </div>
        {/* Glow behind bar */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[80%] h-10 bg-primary/10 blur-[40px] opacity-50 pointer-events-none" />
      </div>

      {/* Steps List - Premium Cards */}
      <div className="w-full space-y-3">
        {steps.map((step) => (
          <div 
            key={step.id}
            className={cn(
              "flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all duration-500",
              step.status === "processing" 
                ? "bg-white/5 dark:bg-zinc-900/60 border-primary/40 shadow-[0_20px_50px_rgba(0,0,0,0.2)] scale-[1.02] z-10" 
                : "bg-black/5 dark:bg-white/[0.02] border-white/[0.05] opacity-60"
            )}
          >
            <div className="flex items-center gap-3 md:gap-5">
              <div className={cn(
                "h-8 w-8 md:h-10 md:w-10 shrink-0 rounded-lg md:rounded-xl flex items-center justify-center border transition-colors",
                step.status === "complete" ? "bg-green-500/10 border-green-500/20 text-green-500" :
                step.status === "processing" ? "bg-primary/20 border-primary/30 text-primary shadow-[0_0_15px_rgba(245,166,35,0.2)]" :
                step.status === "error" ? "bg-destructive/10 border-destructive/20 text-destructive" :
                "bg-zinc-500/5 border-white/[0.03] text-muted-foreground/30"
              )}>
                {step.status === "complete" && <CheckCircle2 className="w-[18px] h-[18px] md:w-5 md:h-5" />}
                {step.status === "processing" && <Loader2 className="w-[18px] h-[18px] md:w-5 md:h-5 animate-spin" />}
                {step.status === "error" && <AlertCircle className="w-[18px] h-[18px] md:w-5 md:h-5" />}
                {step.status === "waiting" && <div className="w-1.5 h-1.5 rounded-full bg-current opacity-20" />}
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "font-bold text-sm tracking-tight",
                  step.status === "waiting" ? "text-muted-foreground/40" : "text-foreground/90"
                )}>
                  {step.label}
                </span>
                {step.status === "processing" && !step.detail && (
                  <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest animate-pulse mt-0.5">Processing</span>
                )}
                {step.detail && (step.status === "processing" || step.status === "complete") && (
                  <span className="text-[10px] font-medium text-muted-foreground/70 mt-0.5 truncate max-w-[300px]">{step.detail}</span>
                )}
              </div>
            </div>
            
            {step.status === "complete" && (
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-green-500" />
                <span className="text-[10px] font-black text-green-500 uppercase tracking-widest opacity-80">Sync Complete</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
