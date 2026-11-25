import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex h-5.5 items-center gap-1.5 rounded-sm px-2 text-caption whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        muted: "bg-muted text-foreground",
        outline: "text-foreground ring-1 ring-border ring-inset",
        terracotta: "bg-tint-terracotta-bg text-tint-terracotta-fg",
        red: "bg-tint-red-bg text-tint-red-fg",
        amber: "bg-tint-amber-bg text-tint-amber-fg",
        green: "bg-tint-green-bg text-tint-green-fg",
        teal: "bg-tint-teal-bg text-tint-teal-fg",
        blue: "bg-tint-blue-bg text-tint-blue-fg",
        violet: "bg-tint-violet-bg text-tint-violet-fg",
        pink: "bg-tint-pink-bg text-tint-pink-fg",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
