import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Renk anlamları (dokümandaki kural):
 * success = tamamlandı/ödendi, warning = bekliyor/kısmi, danger = gecikmiş/risk,
 * info = bilgi, neutral = pasif/kapalı, brand = vurgulu durum.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-canvas text-ink-soft ring-1 ring-line ring-inset",
        brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-100 ring-inset",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
        info: "bg-info-50 text-info-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const dotColors = {
  neutral: "bg-ink-faint",
  brand: "bg-brand-500",
  success: "bg-success-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  info: "bg-info-600",
} as const;

export type BadgeTone = keyof typeof dotColors;

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn("size-1.5 rounded-full", dotColors[tone ?? "neutral"])} />}
      {children}
    </span>
  );
}
