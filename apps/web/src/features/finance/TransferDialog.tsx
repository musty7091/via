import { useState } from "react";

import { useCashAccounts, useCreateTransfer } from "@/features/finance/api";
import { formatMoney, todayISO, type Currency } from "@/shared/lib/format";
import { parseMoneyInput } from "@/shared/lib/validation";
import { Button, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

export function TransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const accounts = useCashAccounts(open);
  const create = useCreateTransfer();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const list = accounts.data ?? [];
  const source = list.find((a) => a.id === Number(fromId));
  const target = list.find((a) => a.id === Number(toId));
  const exchange = Boolean(source && target && source.currency !== target.currency);

  const close = (next: boolean) => {
    if (!next) {
      setFromId("");
      setToId("");
      setFromAmount("");
      setToAmount("");
      setDate(todayISO());
      setNote("");
      setError(null);
      create.reset();
    }
    onOpenChange(next);
  };

  const submit = () => {
    setError(null);
    const amount = parseMoneyInput(fromAmount);
    const received = exchange ? parseMoneyInput(toAmount) : null;
    if (!source || !target) return setError("Kaynak ve hedef hesabı seçin.");
    if (!amount) return setError("Geçerli bir tutar girin.");
    if (exchange && !received) return setError(`Hesaba giren ${target.currency} tutarını girin.`);
    create.mutate(
      {
        transfer_date: date,
        from_account_id: source.id,
        to_account_id: target.id,
        from_amount: amount,
        to_amount: received,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Transfer kaydedildi.");
          close(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Hesaplar Arası Transfer"
      description="Kasadan bankaya yatırma, döviz bozdurma gibi işlemler."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Transferi Kaydet
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Çıkan hesap" required>
          {(p) => (
            <Select {...p} value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">Seçin</option>
              {list.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {formatMoney(a.balance, a.currency as Currency)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Giren hesap" required>
          {(p) => (
            <Select {...p} value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Seçin</option>
              {list
                .filter((a) => a.id !== Number(fromId))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label={`Çıkan tutar${source ? ` (${source.currency})` : ""}`} required>
          {(p) => <Input {...p} value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} inputMode="decimal" />}
        </Field>
        {exchange ? (
          <Field label={`Giren tutar (${target?.currency})`} required hint="Bozdurma sonrası hesaba giren">
            {(p) => <Input {...p} value={toAmount} onChange={(e) => setToAmount(e.target.value)} inputMode="decimal" />}
          </Field>
        ) : (
          <Field label="Tarih">
            {(p) => <Input {...p} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        {exchange && (
          <Field label="Tarih">
            {(p) => <Input {...p} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />}
        </Field>
        {error && <p className="text-sm text-danger-600 sm:col-span-2">{error}</p>}
        <FormError error={create.error} />
      </div>
    </Dialog>
  );
}
