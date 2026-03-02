import { STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-zinc-100 text-zinc-700",
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
