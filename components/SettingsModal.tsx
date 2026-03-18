"use client";

import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface KeyState {
  set: boolean;
  masked: string;
}

const FIELDS = [
  { key: "GOOGLE_API_KEY", label: "Google Gemini API Key", required: true, placeholder: "AIza..." },
  { key: "QDRANT_URL", label: "Qdrant URL", required: true, placeholder: "https://xxx.cloud.qdrant.io:6333" },
  { key: "QDRANT_API_KEY", label: "Qdrant API Key", required: true, placeholder: "Your Qdrant API key" },
  { key: "GITHUB_TOKEN", label: "GitHub Token", required: false, placeholder: "ghp_... (optional)" },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [keys, setKeys] = useState<Record<string, KeyState>>({});
  const [values, setValues] = useState<Record<string, string>>({});
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
        setValues({});
        setVisible({});
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    const toSave: Record<string, string> = {};
    let hasValue = false;
    for (const { key } of FIELDS) {
      if (values[key]?.trim()) {
        toSave[key] = values[key].trim();
        hasValue = true;
      }
    }
    if (!hasValue) return;

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              Settings
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              API keys are stored locally in ~/.codelens/.env
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 pb-8 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {FIELDS.map(({ key, label, required, placeholder }) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {label}
                    </label>
                    {!required && (
                      <span className="text-[10px] text-muted-foreground/50 uppercase">Optional</span>
                    )}
                    {keys[key]?.set && !values[key] && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                        <Check size={10} /> Configured
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={visible[key] ? "text" : "password"}
                      value={values[key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [key]: e.target.value }))
                      }
                      placeholder={keys[key]?.set ? keys[key].masked : placeholder}
                      className={cn(
                        "w-full px-4 py-3 pr-12 rounded-2xl text-sm font-mono",
                        "bg-background/50 border border-white/5",
                        "text-foreground placeholder:text-muted-foreground/40",
                        "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20",
                        "transition-all"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setVisible((v) => ({ ...v, [key]: !v[key] }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
                    >
                      {visible[key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving || !Object.values(values).some((v) => v?.trim())}
                className={cn(
                  "w-full py-3 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all cursor-pointer",
                  "border border-primary/30",
                  saved
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-primary/10 text-primary hover:bg-primary/20",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin mx-auto" />
                ) : saved ? (
                  "Saved"
                ) : (
                  "Save Changes"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
