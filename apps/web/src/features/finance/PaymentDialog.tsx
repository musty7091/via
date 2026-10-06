import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCashAccounts, usePayPayable, type Payable } from "@/features/finance/api";
import { usePartners } from "@/features/partners/api";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { formatMoney, todayISO, type Currency } from "@/shared/lib/format";
import { paymentMethodOptions } from "@/shared/lib/labels";
import {
  formatMoneyInput,
  moneyInput,
  optionalMoneyInput,
  optionalRateInput,
  optionalText,
} from "@/shared/lib/validation";
import { Button, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  source: z.string().min(1, "Ödemenin kaynağını seçin."),
  payment_date: z.string().min(1, "Tarih girin."),
  amount: moneyInput,
  currency: z.enum(["TRY", "EUR", "GBP", "USD"]),
  rate: optionalRateInput,
  applied_amount: optionalMoneyInput,
  method: z.enum(["cash", "bank_transfer", "card", "cheque", "other"]),
  document_no: optionalText(60),
  note: optionalText(2000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function PaymentDialog({ payable, onClose }: { payable: Payable | null; onClose: () => void }) {
  const open = payable !== null;
  const accounts = useCashAccounts(open);
  const partners = usePartners(false, open);
  const pay = usePayPayable();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const source = useWatch({ control, name: "source" }) ?? "";
  const currency = useWatch({ control, name: "currency" });
  const suggestedRate = useSuggestedRate({
    currency: currency,
    day: useWatch({ control, name: "payment_date" }),
    current: useWatch({ control, name: "rate" }),
    apply: (value) => setValue("rate", value),
    enabled: open,
  });
  const payableCurrency = payable?.currency as Currency | undefined;

  useEffect(() => {
    if (!payable) return;
    reset({
      source: "",
      payment_date: todayISO(),
      amount: formatMoneyInput(payable.remaining_amount),
      currency: payable.currency,
      rate: payable.currency !== "TRY" ? String(Number(payable.rate)) : "",
      applied_amount: "",
      method: "bank_transfer",
      document_no: "",
      note: "",
    });
  }, [payable, reset]);

  const cashAccount = source.startsWith("cash:") ? accounts.data?.find((a) => a.id === Number(source.slice(5))) : undefined;
  useEffect(() => {
    if (cashAccount) setValue("currency", cashAccount.currency);
  }, [cashAccount, setValue]);

  const close = () => {
    pay.reset();
    onClose();
  };

  const onSubmit = handleSubmit((v) => {
    if (!payable) return;
    if (v.currency !== "TRY" && !v.rate) return setError("rate", { message: "TL kuru zorunludur." });
    if (v.currency !== payableCurrency && !v.applied_amount)
      return setError("applied_amount", { message: `Kapattığı ${payableCurrency} tutarını girin.` });
    const [kind, id] = v.source.split(":");
    pay.mutate(
      {
        id: payable.id,
        body: {
          payment_date: v.payment_date,
          amount: v.amount,
          currency: v.currency,
          rate: v.currency === "TRY" ? null : v.rate,
          applied_amount: v.currency !== payableCurrency ? v.applied_amount : null,
          cash_account_id: kind === "cash" ? Number(id) : null,
          partner_id: kind === "partner" ? Number(id) : null,
          method: v.method,
          document_no: v.document_no,
          note: v.note,
        },
      },
      {
        onSuccess: () => {
          toast.success("Ödeme kaydedildi.");
          close();
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Ödeme Yap"
      description={payable ? `${payable.payee?.name ?? payable.title} · ${payable.event?.name ?? "Genel gider"}` : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Vazgeç
          </Button>
          <Button type="submit" form="payment-form" loading={pay.isPending}>
            Ödemeyi Kaydet
          </Button>
        </>
      }
    >
      {payable && (
        <form id="payment-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <div className="rounded-md bg-surface-muted px-4 py-3 text-sm sm:col-span-2">
            Kalan borç: <strong className="font-semibold">{formatMoney(payable.remaining_amount, payableCurrency)}</strong>
            <span className="text-ink-muted"> / {formatMoney(payable.amount, payableCurrency)}</span>
          </div>
          <Field label="Ödeme kaynağı" required error={errors.source?.message} className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register("source")}>
                <option value="">Seçin</option>
                <optgroup label="Şirket kasası / bankası">
                  {accounts.data?.map((a) => (
                    <option key={a.id} value={`cash:${a.id}`}>
                      {a.name} · bakiye {formatMoney(a.balance, a.currency as Currency)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ortak cebinden ödedi (şirket ortağa borçlanır)">
                  {partners.data?.map((partner) => (
                    <option key={partner.id} value={`partner:${partner.id}`}>
                      {partner.full_name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            )}
          </Field>
          <Field label="Tarih" required>
            {(p) => <Input {...p} {...register("payment_date")} type="date" max={todayISO()} />}
          </Field>
          <Field label="Ödeme şekli">
            {(p) => (
              <Select {...p} {...register("method")}>
                {paymentMethodOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tutar" required error={errors.amount?.message}>
            {(p) => <Input {...p} {...register("amount")} inputMode="decimal" />}
          </Field>
          <Field label="Para birimi">
            {(p) => <CurrencySelect {...p} {...register("currency")} disabled={Boolean(cashAccount)} />}
          </Field>
          {currency !== "TRY" && (
            <Field label={`Günün kuru (1 ${currency} = ? TL)`} required error={errors.rate?.message} hint={suggestedRate.hint}>
              {(p) => <Input {...p} {...register("rate")} inputMode="decimal" />}
            </Field>
          )}
          {currency !== payableCurrency && (
            <Field label={`Kapattığı tutar (${payableCurrency})`} required error={errors.applied_amount?.message}>
              {(p) => <Input {...p} {...register("applied_amount")} inputMode="decimal" />}
            </Field>
          )}
          <Field label="Belge no">{(p) => <Input {...p} {...register("document_no")} />}</Field>
          <Field label="Not" className="sm:col-span-2">
            {(p) => <Textarea {...p} {...register("note")} className="min-h-16" />}
          </Field>
          <FormError error={pay.error} />
        </form>
      )}
    </Dialog>
  );
}
