import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCatalogOptions, type Artist, type Supplier } from "@/features/catalog/api";
import { useCreatePayable, useUpdatePayable, type Payable } from "@/features/finance/api";
import {
  formatMoneyInput,
  moneyInput,
  optionalDate,
  optionalRateInput,
  optionalText,
  requiredText,
} from "@/shared/lib/validation";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { Button, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  title: requiredText(2, 200, "Açıklama"),
  payee: z.string(),
  amount: moneyInput,
  currency: z.enum(["TRY", "EUR", "GBP", "USD"]),
  rate: optionalRateInput,
  due_date: optionalDate,
  note: optionalText(2000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  /** Verilirse düzenleme */
  payable?: Payable | null;
}

/** Etkinliğe ek maliyet (borç) ekleme veya gerçekleşen maliyete göre borcu düzeltme. */
export function PayableDialog({ open, onOpenChange, eventId, payable }: Props) {
  const artists = useCatalogOptions<Artist>("artists", open);
  const suppliers = useCatalogOptions<Supplier>("suppliers", open);
  const create = useCreatePayable();
  const update = useUpdatePayable();
  const mutation = payable ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const currency = useWatch({ control, name: "currency" });
  const suggestedRate = useSuggestedRate({
    currency: currency,
    day: undefined,
    current: useWatch({ control, name: "rate" }),
    apply: (value) => setValue("rate", value),
    enabled: open,
  });
  const hasPayments = Boolean(payable && Number(payable.paid_amount) > 0);

  useEffect(() => {
    if (!open) return;
    reset({
      title: payable?.title ?? "",
      payee: payable?.payee ? `${payable.payee_type}:${payable.payee.id}` : "",
      amount: formatMoneyInput(payable?.amount),
      currency: payable?.currency ?? "TRY",
      rate: payable && payable.currency !== "TRY" ? String(Number(payable.rate)) : "",
      due_date: payable?.due_date ?? "",
      note: payable?.note ?? "",
    });
  }, [open, payable, reset]);

  const close = (next: boolean) => {
    if (!next) mutation.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) => {
    if (v.currency !== "TRY" && !v.rate) return setError("rate", { message: "TL kuru zorunludur." });
    const [type, id] = v.payee.split(":");
    const payee = {
      artist_id: type === "artist" ? Number(id) : null,
      supplier_id: type === "supplier" ? Number(id) : null,
    };
    const done = {
      onSuccess: () => {
        toast.success(payable ? "Borç güncellendi." : "Borç eklendi.");
        close(false);
      },
    };
    if (payable) {
      update.mutate(
        {
          id: payable.id,
          body: {
            title: v.title,
            amount: v.amount,
            ...(hasPayments || v.currency === "TRY" ? {} : { rate: v.rate }),
            due_date: v.due_date,
            note: v.note,
            ...payee,
          },
        },
        done,
      );
    } else {
      create.mutate(
        {
          event_id: eventId,
          title: v.title,
          amount: v.amount,
          currency: v.currency,
          rate: v.currency === "TRY" ? null : v.rate,
          due_date: v.due_date,
          note: v.note,
          ...payee,
        },
        done,
      );
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={payable ? "Borcu Düzenle" : "Ek Maliyet / Borç Ekle"}
      description={
        payable
          ? "Gerçekleşen maliyet farklıysa tutarı düzeltin; fark muhasebeye düzeltme kaydıyla işlenir."
          : "Anlaşmada öngörülmeyen ek maliyet (ör. ek ses ekipmanı)."
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="payable-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="payable-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Açıklama" required error={errors.title?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("title")} />}
        </Field>
        <Field label="Kime ödenecek?" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("payee")}>
              <option value="">Belirtilmedi</option>
              <optgroup label="Sanatçılar">
                {artists.data?.map((a) => (
                  <option key={a.id} value={`artist:${a.id}`}>
                    {a.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tedarikçiler">
                {suppliers.data?.map((s) => (
                  <option key={s.id} value={`supplier:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label="Tutar" required error={errors.amount?.message}>
          {(p) => <Input {...p} {...register("amount")} inputMode="decimal" />}
        </Field>
        <Field label="Para birimi" hint={payable ? "Değiştirilemez" : undefined}>
          {(p) => <CurrencySelect {...p} {...register("currency")} disabled={Boolean(payable)} />}
        </Field>
        {currency !== "TRY" && (
          <Field
            label={`Kur (1 ${currency} = ? TL)`}
            required
            error={errors.rate?.message}
            hint={hasPayments ? "Ödeme yapıldığı için değiştirilemez" : suggestedRate.hint}
          >
            {(p) => <Input {...p} {...register("rate")} inputMode="decimal" disabled={hasPayments} />}
          </Field>
        )}
        <Field label="Vade">{(p) => <Input {...p} {...register("due_date")} type="date" />}</Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("note")} className="min-h-16" />}
        </Field>
        <FormError error={mutation.error} />
      </form>
    </Dialog>
  );
}
