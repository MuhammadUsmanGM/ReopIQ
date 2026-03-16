"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RepoInput } from "@/components/RepoInput";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProcessingScreen, Step } from "@/components/ProcessingScreen";
import { Toaster, toast } from "sonner";
import { ArrowRight, Github, Linkedin, Database } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Load recent repos from local storage
    const stored = localStorage.getItem("codelens_recent");
    if (stored) setRecentRepos(JSON.parse(stored));
  }, []);

  const saveToRecent = (repoId: string) => {
    setRecentRepos(prev => {
      const updated = [repoId, ...prev.filter(r => r !== repoId)].slice(0, 5);
      localStorage.setItem("codelens_recent", JSON.stringify(updated));
      return updated;
    });
  };

  const handleAnalyze = async (url: string) => {
    // Abort any previous ingestion stream
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let toastId: string | number = "";
    try {
      // 1. Parse & validate URL
      const cleanUrl = url.replace(/^https?:\/\//, "").replace(/^github\.com\//, "");
      const parts = cleanUrl.split("/").filter(Boolean);
      if (parts.length < 2 || !/^[a-zA-Z0-9._-]+$/.test(parts[0]) || !/^[a-zA-Z0-9._-]+$/.test(parts[1])) {
        throw new Error("Please enter a valid GitHub repository URL (e.g. github.com/owner/repo)");
      }
      const repoId = `${parts[0]}/${parts[1].replace(/\.git$/, "")}`.toLowerCase();

      toastId = toast.loading("Checking neural index...", {
        style: {
          borderRadius: '16px',
          background: '#111',
          color: '#fff',
          border: '1px solid rgba(245, 166, 35, 0.2)'
        }
      });

      // 2. Proactive UI Shift
      const name = parts[1].replace(/\.git$/, "");
      setRepoName(name);
      setSteps(INITIAL_STEPS);
      setProgress(5);

      // 3. Check Cache First
      const checkRes = await fetch(`/api/repo/${encodeURIComponent(repoId)}`, {
        signal: abortController.signal,
      });
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.status === "ready") {
          saveToRecent(repoId);
          toast.success("Intelligence established!", {
            id: toastId,
            duration: 3000
          });
          router.push(`/chat/${encodeURIComponent(repoId)}`);
          return;
        }
      }

      // 4. Cache Miss — Start Ingestion
      setIsAnalyzing(true);
      toast.dismiss(toastId);
      toast.success("Identity verified. Starting neural mapping...", {
        duration: 4000
      });

      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_url: url }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Neural mapping initialization failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Neural link failed to establish (Reader Error)");

      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

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
              streamError = event.message || "An unknown error occurred";
              break;
            }

            const stepOrder = ["validating", "fetching", "filtering", "chunking", "embedding", "complete"];
            const currentIdx = stepOrder.indexOf(event.step);

            updateProgress(event.step, currentIdx);

            if (event.step === "complete") {
              saveToRecent(event.repo_id);
              toast.success("Neural link established! Data indexed.", {
                duration: 5000
              });
              setIsAnalyzing(false);
              setSteps(INITIAL_STEPS);
              setTimeout(() => {
                router.push(`/chat/${encodeURIComponent(event.repo_id)}`);
              }, 1500);
            }
          } catch (e) {
            // JSON parse error on SSE event — skip malformed event
          }
        }

        // Break out of the read loop if we got a stream error
        if (streamError) break;
      }

      // If the stream sent an error event, throw it to the outer catch
      if (streamError) {
        throw new Error(streamError);
      }
    } catch (error: any) {
      // Ignore abort errors (user navigated away or re-submitted)
      if (error.name === "AbortError") return;

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
    <main className="relative min-h-screen bg-background overflow-x-hidden selection:bg-primary/30">
      <Toaster 
        position="top-center" 
        visibleToasts={3} 
        expand={false} 
        duration={7000} 
        theme="system"
        closeButton
        richColors
      />
      
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 mesh-gradient opacity-40 dark:opacity-20" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-amber-500/5 blur-[100px] rounded-full delay-1000 animate-pulse" />
      </div>

      {/* Header */}
      <div className="absolute top-0 right-0 p-8 z-50">
        <ThemeToggle />
      </div>

      <div className={cn(
        "relative z-10 container mx-auto px-4 md:px-6 py-12 md:py-20 flex flex-col items-center justify-start md:justify-center min-h-screen",
        !isAnalyzing ? "gap-12 md:gap-20" : "gap-0"
      )}>
        {!isAnalyzing ? (
          <>
            <RepoInput onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
            
            {recentRepos.length > 0 && (
              <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground/60 whitespace-nowrap">
                    NEURAL HISTORY
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentRepos.map((repo) => (
                    <button
                      key={repo}
                      onClick={() => router.push(`/chat/${encodeURIComponent(repo)}`)}
                      className="group relative flex flex-col p-6 rounded-3xl bg-card/30 border border-white/5 hover:border-primary/40 hover:bg-card/50 transition-all duration-500 text-left overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-primary/5 cursor-pointer active:scale-95"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight size={14} className="text-primary" />
                      </div>
                      <span className="text-xs font-bold text-primary mb-2 uppercase tracking-tighter opacity-70 group-hover:opacity-100">Index Active</span>
                      <span className="text-lg font-semibold truncate text-foreground/90 group-hover:text-foreground">{repo}</span>
                      <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        <div className="w-1 h-4 bg-primary/30 rounded-full group-hover:bg-primary group-hover:h-6 transition-all" />
                        Explore Intelligence
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Professional Footer */}
            <footer className="w-full max-w-4xl pt-20 pb-10 flex flex-col items-center gap-8 border-t border-white/5 mt-auto">
              <div className="flex items-center gap-6">
                <a 
                  href="https://github.com/MuhammadUsmanGM" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
                >
                  <Github size={16} className="group-hover:rotate-12 transition-transform" />
                  GitHub
                </a>
                <div className="w-1 h-1 rounded-full bg-border" />
                <a 
                  href="https://www.linkedin.com/in/muhammad-usman-ai-dev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
                >
                  <Linkedin size={16} className="group-hover:-rotate-12 transition-transform" />
                  LinkedIn
                </a>
              </div>
              
              <div className="flex flex-col items-center gap-2 opacity-30">
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase">
                  © {new Date().getFullYear()} CODELENS • Neural Codebase Explorer
                </span>
                <span className="text-[9px] font-medium tracking-[0.1em] uppercase">Privacy Focused • Performance Driven</span>
              </div>
            </footer>
          </>
        ) : (
          <div className="w-full flex justify-center items-center">
            <ProcessingScreen steps={steps} progress={progress} repoName={repoName} />
          </div>
        )}
      </div>
    </main>
  );
}
