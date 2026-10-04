import { initials } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
  index?: number;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
