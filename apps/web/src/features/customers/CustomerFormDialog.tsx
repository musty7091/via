import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useSaveCustomer, type Customer } from "@/features/customers/api";
import { CURRENCIES } from "@/shared/lib/format";
import { customerTypeOptions, invoiceOptions, riskOptions } from "@/shared/lib/labels";
import { optionalEmail, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  customer_type: z.enum(["company", "hotel", "restaurant", "venue", "organizer", "agency", "public", "individual", "other"]),
  name: requiredText(2, 160, "Müşteri adı"),
  short_name: optionalText(160),
  tax_number: optionalText(40),
  tax_office: optionalText(80),
  phone: optionalText(40),
  email: optionalEmail,
  city: optionalText(80),
  district: optionalText(80),
  address: optionalText(4000),
  default_invoice: z
    .enum(["", "with_invoice", "without_invoice"])
    .transform((value) => (value === "" ? null : value)),
  default_currency: z.enum(["TRY", "EUR", "GBP", "USD"]),
  payment_term_days: z
    .string()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) <= 365), "0 ile 365 arasında gün girin.")
    .transform((v) => (v === "" ? null : Number(v))),
  risk_level: z.enum(["normal", "watch", "blocked"]),
  risk_note: optionalText(4000),
  notes: optionalText(4000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function defaults(customer?: Customer | null): FormInput {
  return {
    customer_type: customer?.customer_type ?? "company",
    name: customer?.name ?? "",
    short_name: customer?.short_name ?? "",
    tax_number: customer?.tax_number ?? "",
    tax_office: customer?.tax_office ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    city: customer?.city ?? "",
    district: customer?.district ?? "",
    address: customer?.address ?? "",
    default_invoice: customer?.default_invoice ?? "",
    default_currency: customer?.default_currency ?? "TRY",
    payment_term_days: customer?.payment_term_days?.toString() ?? "",
    risk_level: customer?.risk_level ?? "normal",
    risk_note: customer?.risk_note ?? "",
    notes: customer?.notes ?? "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onSaved?: (customer: Customer) => void;
}

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const save = useSaveCustomer();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset(defaults(customer));
  }, [open, customer, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((body) =>
    save.mutate(
      { id: customer?.id, body },
      {
        onSuccess: (saved) => {
          toast.success(customer ? "Müşteri güncellendi." : "Müşteri oluşturuldu.");
          close(false);
          onSaved?.(saved);
        },
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={customer ? "Müşteriyi Düzenle" : "Yeni Müşteri"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="customer-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Müşteri adı" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} placeholder="Ör. Merit Park Hotel" />}
        </Field>
        <Field label="Müşteri türü" required>
          {(p) => (
            <Select {...p} {...register("customer_type")}>
              {customerTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Kısa ad" hint="Listelerde görünür">
          {(p) => <Input {...p} {...register("short_name")} />}
        </Field>
        <Field label="Telefon">{(p) => <Input {...p} {...register("phone")} type="tel" />}</Field>
        <Field label="E-posta" error={errors.email?.message}>
          {(p) => <Input {...p} {...register("email")} type="email" />}
        </Field>
        <Field label="Vergi no">{(p) => <Input {...p} {...register("tax_number")} />}</Field>
        <Field label="Vergi dairesi">{(p) => <Input {...p} {...register("tax_office")} />}</Field>
        <Field label="Şehir">{(p) => <Input {...p} {...register("city")} />}</Field>
        <Field label="İlçe / bölge">{(p) => <Input {...p} {...register("district")} />}</Field>
        <Field label="Adres" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("address")} className="min-h-16" />}
        </Field>

        <p className="pt-2 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase sm:col-span-2">
          Teklif varsayılanları
        </p>
        <Field label="Fatura tercihi" hint="Teklifte öneri olarak gelir">
          {(p) => (
            <Select {...p} {...register("default_invoice")}>
              <option value="">Her işte ayrıca seçilir</option>
              {invoiceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Para birimi">
          {(p) => (
            <Select {...p} {...register("default_currency")}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ödeme vadesi (gün)" error={errors.payment_term_days?.message}>
          {(p) => <Input {...p} {...register("payment_term_days")} inputMode="numeric" />}
        </Field>
        <Field label="Risk durumu">
          {(p) => (
            <Select {...p} {...register("risk_level")}>
              {riskOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Risk notu" className="sm:col-span-2">
          {(p) => <Input {...p} {...register("risk_note")} placeholder="Ör. ödemeleri genelde gecikiyor" />}
        </Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} />}
        </Field>
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
