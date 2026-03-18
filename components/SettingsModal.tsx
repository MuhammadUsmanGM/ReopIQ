"use client";

import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff, Check, Loader2, Cpu, Shield, Globe, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface KeyState {
  set: boolean;
  masked: string;
}

const FIELDS = [
  { key: "GOOGLE_API_KEY", label: "Google Gemini API Key", required: true, placeholder: "AIza...", icon: Key },
  { key: "QDRANT_URL", label: "Qdrant URL", required: true, placeholder: "https://xxx.cloud.qdrant.io:6333", icon: Globe },
  { key: "QDRANT_API_KEY", label: "Qdrant API Key", required: true, placeholder: "Your Qdrant API key", icon: Shield },
  { key: "GITHUB_TOKEN", label: "GitHub Token", required: false, placeholder: "ghp_... (optional)", icon: Key },
  { key: "HF_TOKEN", label: "Hugging Face Token", required: false, placeholder: "hf_... (optional)", icon: Shield },
];

const MODELS = [
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", description: "Extreme efficiency & reasoning" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (Preview)", description: "Next-gen speed & intelligence" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (Preview)", description: "Ultimate ultra-scale reasoning" },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash-lite");
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSaved(false);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setKeys(data);
        if (data.GEMINI_MODEL?.masked) {
          setSelectedModel(data.GEMINI_MODEL.masked);
        }
        setValues({});
        setVisible({});
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    const toSave: Record<string, string> = {
      GEMINI_MODEL: selectedModel
    };
    
    let hasChanges = false;
    if (selectedModel !== keys.GEMINI_MODEL?.masked) hasChanges = true;

    for (const { key } of FIELDS) {
      if (values[key]?.trim()) {
        toSave[key] = values[key].trim();
        hasChanges = true;
      }
    }
    
    if (!hasChanges) return;

    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    });
    setSaving(false);
    setSaved(true);

    // Refresh state
    const data = await fetch("/api/settings").then((r) => r.json());
    setKeys(data);
    setValues({});
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:justify-end overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal / Drawer */}
          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn(
              "relative w-full md:w-[450px] md:h-full bg-card/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-y-auto flex flex-col",
              "mx-4 md:mx-0 rounded-3xl md:rounded-none"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-10 pb-6 sticky top-0 bg-card/95 backdrop-blur-xl z-20">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  System Settings
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 font-medium">
                  <Cpu size={12} className="text-primary/60" />
                  Neural Configuration • v0.1.0
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 rounded-2xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="px-8 pb-12 space-y-10 flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-primary/20" />
                    <Loader2 size={24} className="animate-spin text-primary absolute inset-0 m-auto" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Establishing Link...</p>
                </div>
              ) : (
                <>
                  {/* Model Selection */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="w-1 h-4 bg-primary rounded-full" />
                       <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Reasoning Engine</h3>
                    </div>
                    <div className="grid gap-3">
                      {MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={cn(
                            "flex flex-col p-4 rounded-2xl border transition-all text-left group relative overflow-hidden cursor-pointer",
                            selectedModel === model.id
                              ? "bg-primary/10 border-primary/40 shadow-lg shadow-primary/5"
                              : "bg-muted/10 border-white/5 hover:border-white/10 hover:bg-muted/20"
                          )}
                        >
                          <div className="flex items-center justify-between z-10">
                            <span className={cn(
                              "text-sm font-bold tracking-tight",
                              selectedModel === model.id ? "text-primary" : "text-foreground/80"
                            )}>
                              {model.name}
                            </span>
                            {selectedModel === model.id && (
                              <div className="p-1 rounded-full bg-primary text-primary-foreground">
                                <Check size={10} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 font-medium z-10 group-hover:text-muted-foreground/80">
                            {model.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* API Keys */}
                  <section className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="w-1 h-4 bg-amber-500 rounded-full" />
                       <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Neural Identifiers</h3>
                    </div>
                    
                    <div className="space-y-5">
                      {FIELDS.map(({ key, label, required, placeholder, icon: Icon }) => (
                        <div key={key} className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <Icon size={12} className="text-muted-foreground/60" />
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              {label}
                            </label>
                            {!required && (
                              <span className="text-[9px] text-muted-foreground/30 font-bold uppercase ml-1">Optional</span>
                            )}
                            {keys[key]?.set && !values[key] && (
                              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <Check size={10} strokeWidth={3} /> LINKED
                              </span>
                            )}
                          </div>
                          <div className="relative group">
                            <input
                              type={visible[key] ? "text" : "password"}
                              value={values[key] ?? ""}
                              onChange={(e) =>
                                setValues((v) => ({ ...v, [key]: e.target.value }))
                              }
                              placeholder={keys[key]?.set ? keys[key].masked : placeholder}
                              className={cn(
                                "w-full px-5 py-4 pr-12 rounded-2xl text-xs font-mono transition-all",
                                "bg-background/80 border border-white/5",
                                "text-foreground placeholder:text-muted-foreground/20",
                                "focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 group-hover:border-white/10"
                              )}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setVisible((v) => ({ ...v, [key]: !v[key] }))
                              }
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-pointer"
                            >
                              {visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* Footer / Actions */}
            {!loading && (
              <div className="p-8 sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-white/5 z-20">
                <button
                  onClick={handleSave}
                  disabled={saving || (!Object.values(values).some((v) => v?.trim()) && selectedModel === keys.GEMINI_MODEL?.masked)}
                  className={cn(
                    "w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-[0.2em] transition-all cursor-pointer relative overflow-hidden group shadow-xl",
                    saved
                      ? "bg-emerald-500 text-white shadow-emerald-500/20"
                      : "bg-primary text-primary-foreground shadow-primary/20 hover:scale-[1.02] active:scale-95",
                    "disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed disabled:scale-100"
                  )}
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {saving ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : saved ? (
                      <>
                        <Check size={18} strokeWidth={3} />
                        Intelligence Synchronized
                      </>
                    ) : (
                      "Commit System Changes"
                    )}
                  </div>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                </button>
                <p className="text-[9px] text-center text-muted-foreground/40 mt-4 font-bold uppercase tracking-widest">
                  Encryption Layer: AES-256-GCM Local
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
