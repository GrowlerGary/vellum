import { STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        STATUS_COLORS[status] ?? "bg-[var(--bg-overlay)] text-[var(--text-muted)] border border-[var(--border)]",
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
