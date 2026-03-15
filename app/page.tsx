"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RepoInput } from "@/components/RepoInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProcessingScreen, Step } from "@/components/ProcessingScreen";
import { Toaster, toast } from "react-hot-toast";

const INITIAL_STEPS: Step[] = [
  { id: "validating", label: "Security & Accessibility Check", status: "waiting" },
  { id: "fetching", label: "Mapping Repository Structure", status: "waiting" },
  { id: "filtering", label: "AI File Selection", status: "waiting" },
  { id: "chunking", label: "Neural Code Tokenization", status: "waiting" },
  { id: "embedding", label: "Vector Indexing (Qdrant)", status: "waiting" },
];

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const router = useRouter();

  const handleAnalyze = async (url: string) => {
    try {
      // 1. Parse URL to get repoId
      const cleanUrl = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "");
      const parts = cleanUrl.split("/");
      if (parts.length < 2) throw new Error("Invalid GitHub URL");
      const repoId = `${parts[0]}/${parts[1]}`.toLowerCase();
      
      // 2. Check Cache First (The "Instant" Hack)
      const checkRes = await fetch(`/api/repo/${encodeURIComponent(repoId)}`);
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.status === "ready") {
          toast.success("Using existing index", { icon: "⚡" });
          router.push(`/chat/${encodeURIComponent(repoId)}`);
          return;
        }
      }

      // 3. New Repo? Start Visual Ingestion
      const name = parts[1].replace(".git", "");
      setRepoName(name);
      setIsAnalyzing(true);
      setProgress(5);
      setSteps(INITIAL_STEPS);

      // 2. Start Ingestion
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start ingestion");
      }

      // 3. Parse Stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Connection failed");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          try {
            const event: any = JSON.parse(line.replace("data: ", ""));
            
            if (event.step === "error") {
              throw new Error(event.message);
            }

            // Update UI based on step
            const stepOrder = ["validating", "fetching", "filtering", "chunking", "embedding", "complete"];
            const currentIdx = stepOrder.indexOf(event.step);
            
            updateProgress(event.step, currentIdx);

            if (event.step === "complete") {
              toast.success("Identity established. Redirecting to chat...", { icon: "🔥" });
              setTimeout(() => {
                router.push(`/chat/${encodeURIComponent(event.repo_id)}`);
              }, 1500);
            }
          } catch (e) {
            console.error("Parse Error:", e);
          }
        }
      }
    } catch (error: any) {
      console.error("Analyze Error:", error);
      toast.error(error.message || "Analysis failed");
      setIsAnalyzing(false);
      setSteps(INITIAL_STEPS);
    }
  };

  const updateProgress = (step: string, index: number) => {
    // Basic progress mapping
    const progressMap: Record<string, number> = {
      validating: 10,
      fetching: 25,
      filtering: 45,
      chunking: 70,
      embedding: 90,
      complete: 100
    };

    if (progressMap[step]) setProgress(progressMap[step]);

    setSteps(prev => prev.map((s, idx) => {
      if (idx < index) return { ...s, status: "complete" as const };
      if (idx === index) return { ...s, status: "processing" as const };
      return s;
    }));
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
