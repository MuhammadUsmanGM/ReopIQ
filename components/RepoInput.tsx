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
    <div className="flex flex-col items-center w-full max-w-4xl px-4 animate-in fade-in slide-in-from-bottom-12 duration-1000">
      {/* Premium Logo Presentation */}
      <div className="relative mb-16 group">
        <div className="absolute inset-[-20px] bg-primary/20 blur-[80px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-1000" />
        <div className="relative p-1.5 bg-gradient-to-br from-white/10 via-white/5 to-transparent rounded-[3rem] border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)]">
          <Image
            src="/logo.webp"
            alt="RepoIQ Logo"
            width={160}
            height={160}
            className="rounded-[2.8rem] grayscale-[10%] group-hover:grayscale-0 transition-all duration-1000 brightness-110 shadow-inner"
            priority
          />
        </div>
      </div>

      {/* High-Impact Hero Section */}
      <div className="text-center space-y-6 mb-16 px-4">
        <h1 className="text-4xl sm:text-7xl md:text-8xl font-display tracking-tighter text-foreground leading-[0.9] sm:leading-[0.85]">
          Neural <span className="text-primary italic">Intelligence</span> <br />
          <span className="opacity-40">for your</span> Codebase
        </h1>
        <p className="text-muted-foreground/60 text-base md:text-xl max-w-2xl mx-auto font-medium leading-relaxed tracking-tight">
          Synchronize your repository with a high-performance RAG indexing engine. 
          Architecture discovery and semantic search at light speed.
        </p>
      </div>

      {/* Ultra-Premium Input Form */}
      <div className="relative w-full max-w-3xl group mx-auto">
        {/* Ambient Glow Surround */}
        <div className="absolute -inset-[2px] bg-gradient-to-r from-primary/30 via-amber-500/10 to-primary/30 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
        
        <form 
          onSubmit={handleSubmit}
          className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-2"
        >
          {/* Input Box */}
          <div className="flex items-center flex-1 min-h-[64px] bg-white/70 dark:bg-zinc-900/40 backdrop-blur-2xl border border-black/[0.03] dark:border-white/[0.08] rounded-2xl sm:rounded-[2rem] px-5 group-focus-within:border-primary/40 transition-all duration-500 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[24px_24px_80px_rgba(0,0,0,0.6)]">
            <div className="pr-4 text-primary/40">
              <Github size={22} className="group-hover:text-primary group-focus-within:text-primary transition-colors duration-500" />
            </div>
            <input
              type="text"
              placeholder="Paste Repository URL..."
              className="flex-1 bg-transparent border-none outline-none text-foreground py-4 text-base md:text-lg placeholder:text-zinc-400 dark:placeholder:text-zinc-700 font-medium selection:bg-primary/30"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
            />
          </div>
          
          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="relative h-[60px] sm:h-[64px] sm:w-[200px] bg-primary hover:bg-amber-400 text-black font-black uppercase tracking-[0.1em] rounded-2xl flex items-center justify-center gap-3 transition-all duration-500 active:scale-[0.97] disabled:opacity-20 disabled:cursor-not-allowed group/btn overflow-hidden shadow-lg shadow-primary/20"
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            
            {isAnalyzing ? (
              <Zap className="animate-[pulse_1s_infinite]" size={20} />
            ) : (
              <ArrowRight size={20} />
            )}
            <span className="relative z-10 text-sm">Map Repo</span>
          </button>
        </form>
      </div>

      {/* Technical Status Indicators */}
      <div className="flex flex-wrap justify-center gap-x-16 gap-y-6 mt-24">
        {[
          { icon: Search, label: "Semantic Context" },
          { icon: Shield, label: "Neural Security" },
          { icon: Zap, label: "AI Logic Pipeline" }
        ].map((feat, i) => (
          <div key={i} className="flex items-center gap-4 group cursor-help">
            <div className="h-8 w-[1px] bg-white/5 group-hover:bg-primary/50 transition-colors duration-500" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 group-hover:text-primary/60 transition-colors duration-500">{feat.label}</span>
              <span className="text-[9px] font-bold text-muted-foreground/10 uppercase tracking-widest leading-none mt-1">Status: Active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}