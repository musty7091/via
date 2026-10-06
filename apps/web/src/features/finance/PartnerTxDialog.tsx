import { useState } from "react";

import { useCashAccounts, useCreatePartnerTx, type PartnerBalance } from "@/features/finance/api";
import { formatMoney, todayISO, type Currency } from "@/shared/lib/format";
import { parseMoneyInput } from "@/shared/lib/validation";
import { Button, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

export type PartnerTxKind = "handover" | "payout" | "offset";

const COPY: Record<PartnerTxKind, { title: string; description: string; confirm: string }> = {
  handover: {
    title: "Kasaya Teslim Al",
    description: "Ortağın elindeki şirket parası kasaya/bankaya teslim edilir.",
    confirm: "Teslim Al",
  },
  payout: {
    title: "Ortağa Ödeme Yap",
    description: "Şirket, ortağa olan borcunu (ör. ortağın cebinden ödediği gider) kasadan/bankadan öder.",
    confirm: "Ödemeyi Kaydet",
  },
  offset: {
    title: "Mahsup Et",
    description: "Ortağın elindeki şirket parası ile şirketin ona olan borcu karşılıklı kapatılır; para hareketi olmaz.",
    confirm: "Mahsup Et",
  },
};

interface Props {
  kind: PartnerTxKind | null;
  balance: PartnerBalance | null;
  onClose: () => void;
}

const amountOf = (list: { currency: string; amount: string }[], currency: string) =>
  list.find((x) => x.currency === currency)?.amount ?? "0";

/** Açılışta para birimi ve tutar, ortağın elindeki paradan (ödemede şirketin borcundan) gelir. */
function initial(kind: PartnerTxKind | null, balance: PartnerBalance | null) {
  const source = kind === "payout" ? balance?.owed : balance?.held;
  const first = source?.find((x) => Number(x.amount) > 0);
  return first
    ? { currency: first.currency as Currency, amount: String(Number(first.amount)).replace(".", ",") }
    : { currency: "TRY" as Currency, amount: "" };
}

/** Her ortak/işlem için yeniden kurulur (key ile); durum başlangıç değerinden gelir. */
export function PartnerTxDialog({ kind, balance, onClose }: Props) {
  const open = kind !== null && balance !== null;
  const accounts = useCashAccounts(open);
  const create = useCreatePartnerTx();
  const [currency, setCurrency] = useState<Currency>(() => initial(kind, balance).currency);
  const [amount, setAmount] = useState(() => initial(kind, balance).amount);
  const [accountId, setAccountId] = useState("");
  const [txDate, setTxDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCurrency("TRY");
    setAmount("");
    setAccountId("");
    setTxDate(todayISO());
    setNote("");
    setError(null);
    create.reset();
    onClose();
  };

  if (kind === null || balance === null) return null;
  const copy = COPY[kind];
  const held = amountOf(balance.held, currency);
  const owed = amountOf(balance.owed, currency);
  const limit =
    kind === "handover" ? held : kind === "payout" ? owed : String(Math.max(0, Math.min(Number(held), Number(owed))));
  const needsAccount = kind !== "offset";
  const accountOptions = accounts.data?.filter((a) => a.currency === currency) ?? [];

  const submit = () => {
    setError(null);
    const parsed = parseMoneyInput(amount);
    if (!parsed || Number(parsed) <= 0) return setError("Geçerli bir tutar girin.");
    if (needsAccount && !accountId) return setError("Kasa/banka hesabını seçin.");
    create.mutate(
      {
        kind,
        partner_id: balance.partner.id,
        tx_date: txDate,
        amount: parsed,
        currency,
        cash_account_id: needsAccount ? Number(accountId) : null,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`${copy.title}: işlem kaydedildi.`);
          close();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title={`${copy.title} · ${balance.partner.name}`}
      description={copy.description}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Vazgeç
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-3 rounded-md bg-surface-muted p-3 text-sm sm:col-span-2">
          <div>
            <p className="text-xs text-ink-muted">Ortak üzerindeki şirket parası</p>
            <p className="font-medium">{formatMoney(held, currency)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Şirketin ortağa borcu</p>
            <p className="font-medium">{formatMoney(owed, currency)}</p>
          </div>
        </div>
        <Field label="Para birimi">
          {(p) => (
            <CurrencySelect
              {...p}
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value as Currency);
                setAccountId("");
              }}
            />
          )}
        </Field>
        <Field label="Tarih">
          {(p) => <Input {...p} type="date" value={txDate} max={todayISO()} onChange={(e) => setTxDate(e.target.value)} />}
        </Field>
        <Field label="Tutar" required hint={`En fazla ${formatMoney(limit, currency)}`}>
          {(p) => <Input {...p} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />}
        </Field>
        {needsAccount && (
          <Field label={kind === "handover" ? "Teslim alınan hesap" : "Ödenen hesap"} required>
            {(p) => (
              <Select {...p} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Seçin</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {formatMoney(a.balance, a.currency as Currency)}
                  </option>
                ))}
              </Select>
            )}
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
