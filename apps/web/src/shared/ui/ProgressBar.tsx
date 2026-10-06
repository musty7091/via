import { cn } from "@/shared/lib/cn";

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  tone?: "brand" | "success" | "warning" | "danger";
  className?: string;
}

const tones = { brand: "bg-brand-600", success: "bg-success-600", warning: "bg-warning-600", danger: "bg-danger-600" };

/** İlerleme çubuğu. Ekran okuyucuya "3 / 8" olarak okunur. */
export function ProgressBar({ value, max, label, tone, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = tone ?? (max > 0 && value >= max ? "success" : "brand");
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value} / ${max}`}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-line ring-inset", className)}
    >
      <div className={cn("h-full rounded-full transition-[width]", tones[color])} style={{ width: `${percent}%` }} />
    </div>
  );
}
