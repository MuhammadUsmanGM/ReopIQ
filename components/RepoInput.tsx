"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Github, ArrowRight, Shield, Zap, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepoInputProps {
  onAnalyze: (url: string) => void;
  isAnalyzing: boolean;
}

export function RepoInput({ onAnalyze, isAnalyzing }: RepoInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Logo */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
        <Image
          src="/logo.webp"
          alt="RepoIQ Logo"
          width={120}
          height={120}
          className="relative rounded-2xl shadow-2xl border border-white/10"
          priority
        />
      </div>

      {/* Heading */}
      <h1 className="text-5xl md:text-6xl font-display text-center mb-4 tracking-tight">
        Chat with any <span className="text-primary">Codebase</span>
      </h1>
      
      <p className="text-muted-foreground text-center mb-10 max-w-lg text-lg leading-relaxed">
        Unlock institutional knowledge instantly. RepoiQ uses AI to index, analyze, and answer anything about your repository.
      </p>

      {/* Input Form */}
      <div className="relative w-full group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 to-amber-500/30 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000" />
        <form 
          onSubmit={handleSubmit}
          className="relative flex items-center bg-card border border-border rounded-xl p-2 shadow-xl focus-within:ring-2 focus-within:ring-primary/50 transition-all"
        >
          <div className="pl-4 pr-3 text-muted-foreground">
            <Github size={20} />
          </div>
          <input
            type="text"
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-transparent border-none outline-none text-foreground py-3 text-base"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAnalyzing}
          />
          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {isAnalyzing ? (
              <Zap className="animate-pulse" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            <span>Analyze</span>
          </button>
        </form>
      </div>

      {/* Trust Signals / Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full">
        <div className="flex items-start gap-3 p-4">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Search size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Semantic Search</h3>
            <p className="text-xs text-muted-foreground mt-1">Deep contextual understanding of your logic.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Secure & Read-only</h3>
            <p className="text-xs text-muted-foreground mt-1">We only read public repository data.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Real-time Insights</h3>
            <p className="text-xs text-muted-foreground mt-1">Answers in seconds, not hours of digging.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
