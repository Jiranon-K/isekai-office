import { cva } from "class-variance-authority";
import { Toggle as TogglePrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "focus-ring inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-small font-medium whitespace-nowrap text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-tint-terracotta-bg data-[state=on]:text-tint-terracotta-fg [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
);

function Toggle({ className, ...props }: React.ComponentProps<typeof TogglePrimitive.Root>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants(), className)}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
