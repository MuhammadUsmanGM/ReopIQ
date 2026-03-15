"use client";

import React from "react";
import { CheckCircle2, CircleDashed, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "waiting" | "processing" | "complete" | "error";

export interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

interface ProcessingScreenProps {
  steps: Step[];
  progress: number;
  repoName: string;
}

export function ProcessingScreen({ steps, progress, repoName }: ProcessingScreenProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-lg px-4 animate-in fade-in duration-700">
      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6 border border-primary/20">
        <CircleDashed size={14} className="animate-spin" />
        Analyzing Codebase
      </div>

      <h2 className="text-4xl font-display text-center mb-8 truncate w-full">
        {repoName}
      </h2>

      {/* Progress Bar */}
      <div className="w-full mb-10">
        <div className="flex justify-between items-end mb-2">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-tight">Overall Progress</span>
          <span className="text-2xl font-display text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="w-full space-y-4">
        {steps.map((step) => (
          <div 
            key={step.id}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-all",
              step.status === "processing" ? "bg-card border-primary shadow-lg scale-[1.02]" : "bg-card/50 border-border"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-2 rounded-lg",
                step.status === "complete" ? "bg-green-500/10 text-green-500" :
                step.status === "processing" ? "bg-primary/10 text-primary" :
                step.status === "error" ? "bg-destructive/10 text-destructive" :
                "bg-muted/10 text-muted-foreground"
              )}>
                {step.status === "complete" && <CheckCircle2 size={20} />}
                {step.status === "processing" && <Loader2 size={20} className="animate-spin" />}
                {step.status === "error" && <AlertCircle size={20} />}
                {step.status === "waiting" && <div className="w-5 h-5" />}
              </div>
              <span className={cn(
                "font-medium",
                step.status === "waiting" ? "text-muted-foreground" : "text-foreground"
              )}>
                {step.label}
              </span>
            </div>
            
            {step.status === "complete" && (
              <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Done</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
