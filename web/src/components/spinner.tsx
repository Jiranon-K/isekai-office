import { LoaderCircleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircleIcon
      aria-hidden="true"
      className={cn("size-4 flex-none animate-spin motion-reduce:animate-none", className)}
    />
  );
}
