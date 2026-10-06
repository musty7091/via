import { useState } from "react";

import { useSavePlan, type PaymentPlan } from "@/features/finance/api";
import { formatMoneyInput, parseMoneyInput } from "@/shared/lib/validation";
import { Button, Dialog, Field, FormError, Input, toast } from "@/shared/ui";

interface Props {
  eventId: number;
  currency: string;
  /** undefined: kapalı, null: yeni satır */
  plan: PaymentPlan | null | undefined;
  onClose: () => void;
}

/** Ödeme planı satırı ekleme/düzenleme. Plan beklenen tahsilat takvimidir; muhasebe kaydı değildir. */
export function PlanDialog({ eventId, currency, plan, onClose }: Props) {
  const open = plan !== undefined;
  const save = useSavePlan(eventId);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<PaymentPlan | null | undefined>(undefined);

  // Pencere her açıldığında seçili satırın bilgileri forma yüklenir.
  if (open && loadedFor !== plan) {
    setLoadedFor(plan);
    setTitle(plan?.title ?? "");
    setDueDate(plan?.due_date ?? "");
    setAmount(formatMoneyInput(plan?.amount));
    setError(null);
  }

  const close = () => {
    setLoadedFor(undefined);
    save.reset();
    onClose();
  };

  const submit = () => {
    const parsed = parseMoneyInput(amount);
    if (title.trim().length < 2) return setError("Başlık girin.");
    if (!dueDate) return setError("Vade tarihi girin.");
    if (!parsed) return setError("Geçerli bir tutar girin.");
    save.mutate(
      { id: plan?.id, body: { title: title.trim(), due_date: dueDate, amount: parsed } },
      {
        onSuccess: () => {
          toast.success("Ödeme planı güncellendi.");
          close();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={plan ? "Ödeme Planını Düzenle" : "Ödeme Planına Satır Ekle"}
      description="Ödeme planı beklenen tahsilat takvimidir; muhasebe kaydı oluşturmaz."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Başlık" required>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ör. 2. taksit" />}
        </Field>
        <Field label="Vade" required>
          {(p) => <Input {...p} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
        </Field>
        <Field label={`Tutar (${currency})`} required>
          {(p) => <Input {...p} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />}
        </Field>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <FormError error={save.error} />
      </div>
    </Dialog>
  );
}
