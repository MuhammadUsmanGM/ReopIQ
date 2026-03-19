"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Database, Trash2, Home, AlertTriangle, X, Loader2, Settings } from "lucide-react";
import { ChatWindow } from "@/components/ChatWindow";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SettingsModal } from "@/components/SettingsModal";
import { RepoInfo } from "@/types";
import { Toaster, toast } from "sonner";
import { clearChatHistory } from "@/hooks/useChatHistory";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = decodeURIComponent(params.repoId as string);

  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const fetchRepoInfo = async () => {
      try {
        const res = await fetch(`/api/repo/${encodeURIComponent(repoId)}`);
        if (!res.ok) {
          toast.error("Failed to load repository");
          router.push("/");
          return;
        }
        const data = await res.json();
        if (data.status === "not_found" || data.status === "reindex_required") {
          // Clean stale entry from recent repos
          removeFromRecent(repoId);
          toast.error(data.status === "reindex_required"
            ? "Repository needs re-indexing"
            : "Repository not indexed — please re-analyze it"
          );
          router.push("/");
          return;
        }
        setRepoInfo(data);
      } catch (error) {
        toast.error("Failed to connect to server");
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRepoInfo();
  }, [repoId, router]);

  const removeFromRecent = (id: string) => {
    try {
      const stored = localStorage.getItem("codelens_recent");
      if (stored) {
        const repos: string[] = JSON.parse(stored);
        const updated = repos.filter((r) => r !== id);
        localStorage.setItem("codelens_recent", JSON.stringify(updated));
      }
    } catch {}
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/repo/${encodeURIComponent(repoId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      clearChatHistory(repoId);
      removeFromRecent(repoId);
      setShowDeleteModal(false);
      toast.success("Repository index and chat history deleted successfully.");
      router.push("/");
    } catch (error) {
      toast.error("Failed to delete repository. Please try again.");
      setIsDeleting(false);
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
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden relative">
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toaster 
        position="top-center" 
        visibleToasts={3} 
        expand={false} 
        duration={7000} 
        theme="system"
        closeButton
        richColors
      />
      
      {/* Header */}
      <header className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b border-border bg-background/50 backdrop-blur-md z-10 shrink-0 w-full overflow-hidden">
        <div className="flex items-center gap-1.5 md:gap-4 min-w-0">
          <button 
            onClick={() => router.push("/")}
            className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground shrink-0"
          >
            <Home className="w-[18px] h-[18px] md:w-5 md:h-5" />
          </button>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex flex-col min-w-0">
            <h1 className="text-xs md:text-sm font-bold uppercase tracking-widest text-foreground truncate max-w-[80px] sm:max-w-[200px] md:max-w-[400px]">
              {repoId}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-3 shrink-0 ml-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Settings"
          >
            <Settings className="w-[18px] h-[18px] md:w-5 md:h-5" />
          </button>
          <ThemeToggle />
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-1.5 md:p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors text-muted-foreground"
            title="Delete Index"
          >
            <Trash2 className="w-[18px] h-[18px] md:w-5 md:h-5" />
          </button>
        </div>
      </header>

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Context Explorer */}
        <aside className="hidden lg:flex w-72 border-r border-border flex-col bg-card/30">
          <div className="p-6 border-b border-border">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Neural Context</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-green-500 uppercase tracking-tighter">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Indexed Chunks</span>
                <span className="text-xs font-mono font-bold">{repoInfo?.chunkCount || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Source Map</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                <Database size={12} />
                Indexing complete. AI has full access to repository logic.
              </div>
              {/* Optional: Add a file list here in the future */}
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 relative bg-background/50 min-w-0 overflow-hidden">
          <ChatWindow repoId={repoId} />
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isDeleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Delete Repository</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete the indexed data and chat history for <span className="font-mono font-semibold text-foreground">{repoId}</span>. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => !isDeleting && setShowDeleteModal(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
