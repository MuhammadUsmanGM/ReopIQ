"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Database, Trash2, Home } from "lucide-react";
import { ChatWindow } from "@/components/ChatWindow";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RepoInfo } from "@/types";
import { Toaster, toast } from "react-hot-toast";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = decodeURIComponent(params.repoId as string);
  
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRepoInfo = async () => {
      try {
        const res = await fetch(`/api/repo/${encodeURIComponent(repoId)}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Repository not indexed");
            router.push("/");
            return;
          }
          throw new Error("Failed to fetch repo info");
        }
        const data = await res.json();
        setRepoInfo(data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoInfo();
  }, [repoId, router]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this indexed repository?")) return;
    
    try {
      await fetch(`/api/repo/${encodeURIComponent(repoId)}`, { method: "DELETE" });
      toast.success("Repository data cleared");
      router.push("/");
    } catch (error) {
      toast.error("Failed to delete repository");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Database className="animate-bounce text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <Toaster position="bottom-center" />
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <Home size={20} />
          </button>
          <div className="h-4 w-px bg-border mx-1" />
          <div className="flex flex-col">
            <h1 className="text-sm font-bold uppercase tracking-widest text-foreground truncate max-w-[200px] md:max-w-[400px]">
              {repoId}
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase opacity-70">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {repoInfo?.chunkCount || 0} Chunks Indexed
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button 
            onClick={handleDelete}
            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors text-muted-foreground"
            title="Delete Index"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden relative">
        <ChatWindow repoId={repoId} />
      </main>
    </div>
  );
}
