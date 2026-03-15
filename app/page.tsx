"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RepoInput } from "@/components/RepoInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProcessingScreen, Step } from "@/components/ProcessingScreen";
import { Toaster, toast } from "react-hot-toast";

const INITIAL_STEPS: Step[] = [
  { id: "fetching", label: "Fetching Repository Tree", status: "waiting" },
  { id: "filtering", label: "Filtering Code Files", status: "waiting" },
  { id: "chunking", label: "Semantic Chunking", status: "waiting" },
  { id: "embedding", label: "Generating Vector Embeddings", status: "waiting" },
];

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const router = useRouter();

  const handleAnalyze = async (url: string) => {
    // Extract repo name from URL for display
    try {
      const name = url.split("/").pop() || "Repository";
      setRepoName(name);
      setIsAnalyzing(true);
      
      // Simulation logic for demonstration
      // This will be replaced by SSE (Server-Sent Events) from /api/ingest
      simulateProgress();
      
    } catch (error) {
      toast.error("Invalid GitHub URL");
    }
  };

  const simulateProgress = () => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        // router.push(`/chat/simulated-repo`);
      }
      setProgress(currentProgress);
      
      // Update steps based on progress
      setSteps(prev => prev.map((step, idx) => {
        const stepThreshold = (idx + 1) * 25;
        if (currentProgress >= stepThreshold) return { ...step, status: "complete" };
        if (currentProgress >= stepThreshold - 25) return { ...step, status: "processing" };
        return step;
      }));
    }, 400);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-x-hidden">
      <Toaster position="bottom-center" />
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-30 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full animate-pulse delay-700" />
      </div>

      {/* Header / Theme Toggle */}
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="w-full flex justify-center">
        {!isAnalyzing ? (
          <RepoInput onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
        ) : (
          <ProcessingScreen steps={steps} progress={progress} repoName={repoName} />
        )}
      </div>

      {/* Footer / Info */}
      <footer className="absolute bottom-8 text-muted-foreground text-sm font-medium">
        &copy; {new Date().getFullYear()} REPOIQ. Powered by Gemini 2.0 Flash.
      </footer>
    </main>
  );
}
