import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useEvents } from "@/features/events/api";
import { useCashAccounts, useCreateCollection, useEventFinance } from "@/features/finance/api";
import { usePartners } from "@/features/partners/api";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { formatMoney, todayISO, type Currency } from "@/shared/lib/format";
import { paymentMethodOptions } from "@/shared/lib/labels";
import { moneyInput, optionalMoneyInput, optionalRateInput, optionalText } from "@/shared/lib/validation";
import { Button, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  event_id: z.string().min(1, "Etkinlik seçin."),
  destination: z.string().min(1, "Paranın girdiği yeri seçin."),
  collection_date: z.string().min(1, "Tarih girin."),
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Etkinlik sayfasından açılırsa etkinlik sabittir. */
  eventId?: number;
}

export function CollectionDialog({ open, onOpenChange, eventId }: Props) {
  const accounts = useCashAccounts(open);
  const partners = usePartners(false, open);
  const events = useEvents({ search: "", status: "", period: "all", offset: 0 }, todayISO(), open && !eventId);
  const create = useCreateCollection();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const selectedEvent = Number(useWatch({ control, name: "event_id" })) || 0;
  const destination = useWatch({ control, name: "destination" }) ?? "";
  const currency = useWatch({ control, name: "currency" });
  const suggestedRate = useSuggestedRate({
    currency: currency,
    day: useWatch({ control, name: "collection_date" }),
    current: useWatch({ control, name: "rate" }),
    apply: (value) => setValue("rate", value),
    enabled: open,
  });
  const finance = useEventFinance(selectedEvent);
  const eventCurrency = finance.data?.currency as Currency | undefined;

  useEffect(() => {
    if (!open) return;
    reset({
      event_id: eventId ? String(eventId) : "",
      destination: "",
      collection_date: todayISO(),
      amount: "",
      currency: "TRY",
      rate: "",
      applied_amount: "",
      method: "cash",
      document_no: "",
      note: "",
    });
  }, [open, eventId, reset]);

  // Etkinlik seçilince para birimi etkinliğinkine ayarlanır.
  useEffect(() => {
    if (eventCurrency && !destination.startsWith("cash:")) setValue("currency", eventCurrency);
  }, [eventCurrency, destination, setValue]);

  // Kasa/banka seçilince para birimi hesabınkine sabitlenir.
  const cashAccount = destination.startsWith("cash:")
    ? accounts.data?.find((a) => a.id === Number(destination.slice(5)))
    : undefined;
  useEffect(() => {
    if (cashAccount) setValue("currency", cashAccount.currency);
  }, [cashAccount, setValue]);

  const close = (next: boolean) => {
    if (!next) create.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) => {
    if (v.currency !== "TRY" && !v.rate) return setError("rate", { message: "TL kuru zorunludur." });
    if (eventCurrency && v.currency !== eventCurrency && !v.applied_amount)
      return setError("applied_amount", { message: `Karşıladığı ${eventCurrency} tutarını girin.` });
    const [kind, id] = v.destination.split(":");
    create.mutate(
      {
        event_id: Number(v.event_id),
        collection_date: v.collection_date,
        amount: v.amount,
        currency: v.currency,
        rate: v.currency === "TRY" ? null : v.rate,
        applied_amount: eventCurrency && v.currency !== eventCurrency ? v.applied_amount : null,
        cash_account_id: kind === "cash" ? Number(id) : null,
        partner_id: kind === "partner" ? Number(id) : null,
        method: v.method,
        document_no: v.document_no,
        note: v.note,
      },
      {
        onSuccess: (c) => {
          toast.success(`${c.collection_no} tahsilatı kaydedildi → ${c.destination}`);
          close(false);
        },
      },
    );
  });

  const eventOptions = (events.data?.items ?? []).filter((e) => e.status !== "cancelled");

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Tahsilat Gir"
      description="Müşteriden alınan para. Ortak aldıysa para şirkete teslim edilene kadar ortağın üzerinde görünür."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="collection-form" loading={create.isPending}>
            Tahsilatı Kaydet
          </Button>
        </>
      }
    >
      <form id="collection-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {!eventId && (
          <Field label="Etkinlik" required error={errors.event_id?.message} className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register("event_id")}>
                <option value="">{events.isPending ? "Yükleniyor…" : "Etkinlik seçin"}</option>
                {eventOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.event_no} · {e.title} · {e.customer.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {finance.data && (
          <div className="rounded-md bg-surface-muted px-4 py-3 text-sm sm:col-span-2">
            Müşterinin kalan borcu:{" "}
            <strong className="font-semibold">{formatMoney(finance.data.remaining_amount, finance.data.currency as Currency)}</strong>
            <span className="text-ink-muted"> / {formatMoney(finance.data.total_amount, finance.data.currency as Currency)}</span>
          </div>
        )}
        <Field label="Para nereye girdi?" required error={errors.destination?.message} className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("destination")}>
              <option value="">Seçin</option>
              <optgroup label="Şirket kasası / bankası">
                {accounts.data?.map((a) => (
                  <option key={a.id} value={`cash:${a.id}`}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Ortak aldı (ortak üzerinde kalır)">
                {partners.data?.map((partner) => (
                  <option key={partner.id} value={`partner:${partner.id}`}>
                    {partner.full_name}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label="Tarih" required error={errors.collection_date?.message}>
          {(p) => <Input {...p} {...register("collection_date")} type="date" max={todayISO()} />}
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
        <Field label="Para birimi" hint={cashAccount ? "Hesabın para birimi" : undefined}>
          {(p) => <CurrencySelect {...p} {...register("currency")} disabled={Boolean(cashAccount)} />}
        </Field>
        {currency !== "TRY" && (
          <Field label={`Günün kuru (1 ${currency} = ? TL)`} required error={errors.rate?.message} hint={suggestedRate.hint}>
            {(p) => <Input {...p} {...register("rate")} inputMode="decimal" />}
          </Field>
        )}
        {eventCurrency && currency !== eventCurrency && (
          <Field
            label={`Karşıladığı tutar (${eventCurrency})`}
            required
            hint="Müşteri borcundan düşülecek tutar"
            error={errors.applied_amount?.message}
          >
            {(p) => <Input {...p} {...register("applied_amount")} inputMode="decimal" />}
          </Field>
        )}
        <Field label="Belge no" hint="Makbuz, dekont no">
          {(p) => <Input {...p} {...register("document_no")} />}
        </Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("note")} className="min-h-16" />}
        </Field>
        <FormError error={create.error} />
      </form>
    </Dialog>
  );
}
