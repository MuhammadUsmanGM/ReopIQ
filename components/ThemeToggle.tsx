"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by waiting until mounted
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("flex items-center gap-1 bg-muted/20 p-1 rounded-full border border-border w-[100px] h-[34px]", className)} />
    );
  }

  return (
    <div className={cn("flex items-center gap-1 bg-muted/20 p-1 rounded-full border border-border", className)}>
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "p-1.5 rounded-full transition-all",
          theme === "light" ? "bg-background text-primary shadow-sm" : "hover:bg-muted/30 text-muted-foreground"
        )}
        title="Light Mode"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "p-1.5 rounded-full transition-all",
          theme === "dark" ? "bg-background text-primary shadow-sm" : "hover:bg-muted/30 text-muted-foreground"
        )}
        title="Dark Mode"
      >
        <Moon size={16} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={cn(
          "px-2 py-1 text-xs font-medium rounded-full transition-all",
          theme === "system" ? "bg-background text-primary shadow-sm" : "hover:bg-muted/30 text-muted-foreground"
        )}
      >
        Auto
      </button>
    </div>
  );
}
