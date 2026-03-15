"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const QUESTIONS = [
  "Explain the project structure",
  "How is authentication handled?",
  "What are the main API endpoints?",
  "Identify potential security risks",
  "Summarize the core logic",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  isVisible: boolean;
}

export function SuggestedQuestions({ onSelect, isVisible }: SuggestedQuestionsProps) {
  if (!isVisible) return null;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest pl-1">
        <MessageSquare size={12} />
        Suggested Questions
      </div>
      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="px-4 py-2 text-sm bg-card hover:bg-muted/50 border border-border hover:border-primary/40 rounded-xl transition-all active:scale-95 text-foreground"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
