"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, AlertCircle } from "lucide-react";
import { ChatMessage, ChatSSEEvent } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  repoId: string;
}

export function ChatWindow({ repoId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: text, timestamp: new Date() };
    const botPlaceholder: ChatMessage = { role: "bot", content: "", timestamp: new Date() };
    
    setMessages(prev => [...prev, userMessage, botPlaceholder]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_id: repoId,
          message: text,
          history: messages.slice(0, -1).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("Failed to connect to AI");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader found");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          
          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === "message") {
              setMessages(prev => {
                const last = [...prev];
                const botMsg = last[last.length - 1];
                botMsg.content += data;
                return last;
              });
            } else if (event === "sources") {
              setMessages(prev => {
                const last = [...prev];
                last[last.length - 1].sources = data;
                return last;
              });
            } else if (event === "error") {
              setError(data);
              setIsLoading(false);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-background">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-10 scroll-smooth no-scrollbar"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6">
              <Send size={32} />
            </div>
            <h3 className="text-2xl font-display mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground mb-10 max-w-sm">
              Ask anything about the codebase. I've indexed the files and I'm ready to help.
            </p>
            <SuggestedQuestions 
              isVisible={messages.length === 0} 
              onSelect={handleSend} 
            />
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        
        {isLoading && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-4 items-center text-muted-foreground animate-pulse ml-14">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-widest">Thinking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 border-t border-border bg-background/50 backdrop-blur-md">
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20 animate-in fade-in slide-in-from-bottom-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="relative flex items-center group"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask about the codebase..."
            className="w-full bg-card border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-2xl py-4 pl-6 pr-16 text-foreground outline-none transition-all shadow-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-3 p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground mt-3 uppercase tracking-widest font-bold opacity-50">
          RepoIQ can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  );
}
