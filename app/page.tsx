"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RepoInput } from "@/components/RepoInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProcessingScreen, Step } from "@/components/ProcessingScreen";
import { Toaster, toast } from "react-hot-toast";
import { ArrowRight } from "lucide-react";

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
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Load recent repos from local storage
    const stored = localStorage.getItem("repoiq_recent");
    if (stored) setRecentRepos(JSON.parse(stored));
  }, []);

  const saveToRecent = (repoId: string) => {
    const updated = [repoId, ...recentRepos.filter(r => r !== repoId)].slice(0, 5);
    setRecentRepos(updated);
    localStorage.setItem("repoiq_recent", JSON.stringify(updated));
  };

  const handleAnalyze = async (url: string) => {
    let toastId = "";
    try {
      // 1. Parse URL to get repoId
      const cleanUrl = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "");
      const parts = cleanUrl.split("/");
      if (parts.length < 2) throw new Error("Please enter a valid GitHub repository URL");
      const repoId = `${parts[0]}/${parts[1]}`.toLowerCase();
      
      toastId = toast.loading("Checking neural index...", {
        style: {
          borderRadius: '12px',
          background: '#111',
          color: '#fff',
          border: '1px solid rgba(245, 166, 35, 0.2)'
        }
      });

      // 2. Check Cache First (The "Instant" Hack)
      const checkRes = await fetch(`/api/repo/${encodeURIComponent(repoId)}`);
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.status === "ready") {
          toast.success("Intelligence already established!", {
            id: toastId,
            icon: "⚡",
            duration: 3000
          });
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
      
      toast.dismiss(toastId);
      toast.success("Identity verified. Starting neural mapping...", {
        icon: "🧠",
        duration: 4000
      });

      // 4. Start Ingestion Stream
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Neural mapping initialization failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Neural link failed to establish (Reader Error)");

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

            const stepOrder = ["validating", "fetching", "filtering", "chunking", "embedding", "complete"];
            const currentIdx = stepOrder.indexOf(event.step);
            
            updateProgress(event.step, currentIdx);

            if (event.step === "complete") {
              saveToRecent(event.repo_id);
              toast.success("Neural link established! Data indexed.", {
                className: "bg-primary text-black font-bold",
                icon: "🚀",
                duration: 5000
              });
              setTimeout(() => {
                router.push(`/chat/${encodeURIComponent(event.repo_id)}`);
              }, 1500);
            }
          } catch (e) {
            console.error("Neural Stream Parse Error:", e);
          }
        }
      }
    } catch (error: any) {
      console.error("Critical Ingestion Failure:", error);
      toast.error(error.message || "A neural link interruption occurred", {
        id: toastId,
        style: {
          borderRadius: '12px',
          background: '#450a0a',
          color: '#fecaca',
          border: '1px solid #7f1d1d'
        },
        duration: 5000
      });
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

      <div className="w-full flex flex-col items-center justify-center gap-12">
        {!isAnalyzing ? (
          <>
            <RepoInput onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
            
            {recentRepos.length > 0 && (
              <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-[0.2em] mb-4 pl-1">
                  <span className="w-8 h-px bg-border" />
                  Recent Explorations
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recentRepos.map((repo) => (
                    <button
                      key={repo}
                      onClick={() => router.push(`/chat/${encodeURIComponent(repo)}`)}
                      className="flex items-center justify-between p-4 bg-card/40 hover:bg-card border border-border hover:border-primary/50 rounded-2xl transition-all group text-left"
                    >
                      <span className="text-sm font-medium truncate pr-4">{repo}</span>
                      <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        <ArrowRight size={14} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
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
