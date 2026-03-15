"use client";

import React from "react";
import { Sparkles, User, Terminal } from "lucide-react";
import { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { SourceCitation } from "./SourceCitation";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isBot = message.role === "bot";

  return (
    <div className={cn(
      "flex w-full mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isBot ? "justify-start" : "justify-end"
    )}>
      <div className={cn(
        "flex max-w-[85%] md:max-w-[75%] gap-4",
        isBot ? "flex-row" : "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border",
          isBot ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-border text-muted-foreground"
        )}>
          {isBot ? <Sparkles size={20} /> : <User size={20} />}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3">
          <div className={cn(
            "px-5 py-3 rounded-2xl shadow-sm border",
            isBot 
              ? "bg-card border-border text-foreground rounded-tl-none" 
              : "bg-primary text-primary-foreground border-primary rounded-tr-none"
          )}>
            <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
          </div>

          {/* Sources */}
          {isBot && message.sources && message.sources.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {message.sources.map((source, i) => (
                <SourceCitation key={i} filePath={source} />
              ))}
            </div>
          )}

          {/* Timestamp */}
          <div className={cn(
            "text-[10px] uppercase tracking-widest font-bold opacity-30",
            isBot ? "text-left" : "text-right"
          )}>
            {message.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}
