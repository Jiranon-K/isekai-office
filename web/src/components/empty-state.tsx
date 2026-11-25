import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  headingLevel?: 1 | 2 | 3;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  headingLevel = 3,
  children,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-8 text-center",
        className,
      )}
    >
      {icon && (
        <span aria-hidden="true" className="text-muted-foreground">
          {icon}
        </span>
      )}
      <Heading className="text-body-strong text-foreground">{title}</Heading>
      {description && <p className="max-w-80 text-body text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}
