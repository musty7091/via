import { AlertTriangle, ArrowRight } from "lucide-react";

import { Button } from "@/shared/ui/Button";
import { Dialog } from "@/shared/ui/Dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Bu işlem ne yapacak? (tek cümle) */
  description: string;
  /** Hangi kayıtlar nasıl etkilenecek? Dokümandaki kural: her onay bunu söyler. */
  effects?: string[];
  confirmLabel: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
}

/** Kritik işlemler için standart onay penceresi. window.confirm kullanılmaz. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  effects,
  confirmLabel,
  tone = "primary",
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            Vazgeç
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === "danger" && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger-50 text-danger-600">
            <AlertTriangle className="size-4" aria-hidden />
          </span>
        )}
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">{description}</p>
          {effects && effects.length > 0 && (
            <ul className="space-y-1.5 rounded-md bg-surface-muted p-3 text-sm text-ink-soft">
              {effects.map((effect) => (
                <li key={effect} className="flex gap-2">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-brand-500" aria-hidden />
                  {effect}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
