import { useState } from "react";

import { errorMessage } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Dialog } from "@/shared/ui/Dialog";
import { Field, Textarea } from "@/shared/ui/Field";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  error?: unknown;
  onConfirm: (reason: string) => void;
}

/** Sebep zorunlu iptal penceresi. Kayıt silinmez; ters kayıtla iptal edilir. */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, loading, error, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const close = (next: boolean) => {
    if (!next) setReason("");
    onOpenChange(next);
  };
  const tooShort = reason.trim().length < 3;
  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button variant="danger" loading={loading} disabled={tooShort} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{description}</p>
        <p className="rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          Kayıt silinmez; muhasebede ters kayıtla iptal edilir ve işlem geçmişinde görünür.
        </p>
        <Field label="Sebep" required>
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
        </Field>
        {Boolean(error) && <p className="text-sm text-danger-600">{errorMessage(error)}</p>}
      </div>
    </Dialog>
  );
}
