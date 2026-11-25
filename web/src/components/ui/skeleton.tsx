import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-linear-to-r from-muted via-muted/55 to-muted bg-size-[200%_100%] motion-safe:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
