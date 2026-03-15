"use client";

import React from "react";
import { Copy, ExternalLink, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceCitationProps {
  filePath: string;
  onClick?: () => void;
}

export function SourceCitation({ filePath, onClick }: SourceCitationProps) {
  return (
    <div 
      className="group flex items-center gap-2 px-3 py-1.5 bg-muted/40 hover:bg-muted/60 border border-border rounded-lg transition-all cursor-pointer max-w-[280px]"
      onClick={onClick}
    >
      <FileCode size={14} className="text-primary shrink-0" />
      <span className="text-xs font-medium truncate text-muted-foreground group-hover:text-foreground">
        {filePath}
      </span>
      <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
    </div>
  );
}
