"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { ChatMessage, ChatSSEEvent } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { cn } from "@/lib/utils";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "@/hooks/useChatHistory";

interface ChatWindowProps {
  repoId: string;
}

export function ChatWindow({ repoId }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory(repoId));
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldSaveRef = useRef(true);
  
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

    // Capture history from current messages BEFORE state update
    // Limit to last 20 messages to stay within Gemini's context window
    const historyForApi = messages.slice(-20).map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

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
          history: historyForApi,
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
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: updated[lastIdx].content + data,
                };
                return updated;
              });
            } else if (event === "sources") {
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  sources: data,
                };
                return updated;
              });
            } else if (event === "error") {
              shouldSaveRef.current = false;
              // Remove empty bot placeholder on error
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.role === "bot" && lastMsg.content === "") {
                  return prev.slice(0, -1);
                }
                return prev;
              });
              setError(data);
              setIsLoading(false);
            }
          }
        }
      }
    } catch (err: any) {
      shouldSaveRef.current = false;
      // Remove empty bot placeholder on fetch error
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === "bot" && lastMsg.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
      setError(err.message || "Failed to get response");
    } finally {
      setIsLoading(false);
      if (shouldSaveRef.current) {
        setMessages(prev => {
          saveChatHistory(repoId, prev);
          return prev;
        });
      }
      shouldSaveRef.current = true;
    }
  };

  const handleClearChat = useCallback(() => {
    clearChatHistory(repoId);
    setMessages([]);
    setError(null);
  }, [repoId]);

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto bg-background overflow-hidden min-w-0">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 md:px-6 py-6 md:py-10 scroll-smooth no-scrollbar"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-6">
              <Send size={32} />
            </div>
            <h3 className="text-xl md:text-2xl font-display mb-2">Ready to Analyze</h3>
            <p className="text-sm text-muted-foreground mb-8 md:mb-10 max-w-sm">
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
          <div className="flex gap-3 items-center text-muted-foreground animate-pulse ml-10 md:ml-14">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-[10px] md:text-xs font-semibold uppercase tracking-widest">Thinking...</span>
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
            className="w-full bg-card border border-border focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-2xl py-3 md:py-4 pl-4 md:pl-6 pr-14 md:pr-16 text-sm md:text-base text-foreground outline-none transition-all shadow-sm"
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
        <div className="flex items-center justify-center gap-3 mt-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">
            CodeLens can make mistakes. Verify important information.
          </p>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-[10px] text-muted-foreground/50 hover:text-destructive uppercase tracking-widest font-bold transition-colors flex items-center gap-1"
              title="Clear chat history"
            >
              <Trash2 size={10} />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
