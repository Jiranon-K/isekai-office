import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KbdTone = "default" | "on-primary";

export function Kbd({ children, tone = "default" }: { children: ReactNode; tone?: KbdTone }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5.5 items-center justify-center rounded-sm px-1.5 font-mono text-kbd",
        tone === "default" ? "bg-muted text-muted-foreground" : "bg-transparent opacity-80",
      )}
    >
      {children}
    </kbd>
  );
}
