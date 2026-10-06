import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCatalogOptions, type Supplier } from "@/features/catalog/api";
import { useEvents } from "@/features/events/api";
import { useCashAccounts, useCreateExpense } from "@/features/finance/api";
import { AllocationPicker } from "@/features/finance/AllocationPicker";
import { usePartners } from "@/features/partners/api";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { formatMoney, todayISO, type Currency } from "@/shared/lib/format";
import { EXPENSE_PAID_BY_LABELS, expenseCategoryOptions } from "@/shared/lib/labels";
import { moneyInput, optionalId, optionalRateInput, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  expense_date: z.string().min(1, "Tarih girin."),
  category: z.enum(["rent", "salary", "transport", "marketing", "office", "tax_fees", "equipment", "food", "other"]),
  title: requiredText(2, 200, "Açıklama"),
  amount: moneyInput,
  currency: z.enum(["TRY", "EUR", "GBP", "USD"]),
  rate: optionalRateInput,
  event_id: optionalId,
  allocation: z.enum(["month", "season", "rest_of_season"]),
  paid_by: z.enum(["company", "partner", "unpaid"]),
  cash_account_id: optionalId,
  partner_id: optionalId,
  supplier_id: optionalId,
  document_no: optionalText(60),
  note: optionalText(2000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: number;
}

export function ExpenseDialog({ open, onOpenChange, eventId }: Props) {
  const accounts = useCashAccounts(open);
  const partners = usePartners(false, open);
  const suppliers = useCatalogOptions<Supplier>("suppliers", open);
  const events = useEvents({ search: "", status: "", period: "all", offset: 0 }, todayISO(), open && !eventId);
  const create = useCreateExpense();
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const paidBy = useWatch({ control, name: "paid_by" });
  const selectedEvent = useWatch({ control, name: "event_id" });
  const isGeneral = !eventId && !selectedEvent;
  const currency = useWatch({ control, name: "currency" });
  const allocation = useWatch({ control, name: "allocation" });
  const expenseDate = useWatch({ control, name: "expense_date" });
  const amountText = useWatch({ control, name: "amount" });
  const suggestedRate = useSuggestedRate({
    currency: currency,
    day: useWatch({ control, name: "expense_date" }),
    current: useWatch({ control, name: "rate" }),
    apply: (value) => setValue("rate", value),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    reset({
      expense_date: todayISO(),
      category: eventId ? "equipment" : "office",
      title: "",
      amount: "",
      currency: "TRY",
      rate: "",
      event_id: eventId ? String(eventId) : "",
      allocation: "month",
      paid_by: "company",
      cash_account_id: "",
      partner_id: "",
      supplier_id: "",
      document_no: "",
      note: "",
    });
  }, [open, eventId, reset]);

  const close = (next: boolean) => {
    if (!next) create.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) => {
    if (v.currency !== "TRY" && !v.rate) return setError("rate", { message: "TL kuru zorunludur." });
    if (v.paid_by === "company" && !v.cash_account_id) return setError("cash_account_id", { message: "Hesap seçin." });
    if (v.paid_by === "partner" && !v.partner_id) return setError("partner_id", { message: "Ortağı seçin." });
    create.mutate(
      {
        ...v,
        rate: v.currency === "TRY" ? null : v.rate,
        allocation: v.event_id ? "month" : v.allocation,
        cash_account_id: v.paid_by === "company" ? v.cash_account_id : null,
        partner_id: v.paid_by === "partner" ? v.partner_id : null,
        supplier_id: v.paid_by === "unpaid" ? v.supplier_id : null,
      },
      {
        onSuccess: (e) => {
          toast.success(`${e.expense_no} gideri kaydedildi.`);
          close(false);
        },
      },
    );
  });

  const matchingAccounts = accounts.data?.filter((a) => a.currency === currency) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Gider Gir"
      description={eventId ? "Bu etkinliğe ait ek gider; etkinlik kârından düşer." : "Genel veya etkinliğe bağlı gider."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="expense-form" loading={create.isPending}>
            Gideri Kaydet
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Açıklama" required error={errors.title?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("title")} placeholder="Ör. Ekim ofis kirası" />}
        </Field>
        <Field label="Kategori">
          {(p) => (
            <Select {...p} {...register("category")}>
              {expenseCategoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Tarih" required>
          {(p) => <Input {...p} {...register("expense_date")} type="date" max={todayISO()} />}
        </Field>
        {!eventId && (
          <Field label="Etkinlik" hint="Boş bırakılırsa genel gider" className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register("event_id")}>
                <option value="">Genel gider (etkinliğe bağlı değil)</option>
                {events.data?.items
                  .filter((e) => e.status !== "cancelled")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.event_no} · {e.title}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        )}
        {isGeneral && (
          <AllocationPicker
            value={allocation ?? "month"}
            onChange={(v) => setValue("allocation", v)}
            expenseDate={expenseDate}
            amount={amountText}
            currency={currency}
          />
        )}
        <Field label="Tutar" required error={errors.amount?.message}>
          {(p) => <Input {...p} {...register("amount")} inputMode="decimal" />}
        </Field>
        <Field label="Para birimi">{(p) => <CurrencySelect {...p} {...register("currency")} />}</Field>
        {currency !== "TRY" && (
          <Field label={`Kur (1 ${currency} = ? TL)`} required error={errors.rate?.message} hint={suggestedRate.hint}>
            {(p) => <Input {...p} {...register("rate")} inputMode="decimal" />}
          </Field>
        )}
        <Field label="Kim ödedi?" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("paid_by")}>
              {Object.entries(EXPENSE_PAID_BY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {paidBy === "company" && (
          <Field label="Hesap" required error={errors.cash_account_id?.message} className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register("cash_account_id")}>
                <option value="">Seçin</option>
                {matchingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · bakiye {formatMoney(a.balance, a.currency as Currency)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {paidBy === "partner" && (
          <Field label="Ödeyen ortak" required hint="Şirket bu tutarı ortağa borçlanır" error={errors.partner_id?.message} className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register("partner_id")}>
                <option value="">Seçin</option>
                {partners.data?.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {paidBy === "unpaid" && (
          <Field label="Tedarikçi" hint="Borç açılır; Borçlar ekranından ödenir" className="sm:col-span-2">
            {(p) => (
              <Select {...p} {...register("supplier_id")}>
                <option value="">Belirtilmedi</option>
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Belge / fatura no">{(p) => <Input {...p} {...register("document_no")} />}</Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("note")} className="min-h-16" />}
        </Field>
        <FormError error={create.error} />
      </form>
    </Dialog>
  );
}
