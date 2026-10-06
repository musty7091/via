import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/Card";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}

const iconTones = {
  default: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default", onClick }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">{label}</p>
        {Icon && (
          <span className={cn("grid size-8 place-items-center rounded-md", iconTones[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </>
  );

  if (onClick) {
    return (
      <Card className="transition-colors hover:border-brand-200">
        <button type="button" onClick={onClick} className="block w-full p-4 text-left">
          {content}
        </button>
      </Card>
    );
  }
  return <Card className="p-4">{content}</Card>;
}
