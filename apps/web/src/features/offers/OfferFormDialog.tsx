import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCurrentUser } from "@/features/auth/auth";
import { useCustomer, useCustomerOptions, type Venue } from "@/features/customers/api";
import { useCreateOffer, useUpdateOffer, type Offer } from "@/features/offers/api";
import { usePartners } from "@/features/partners/api";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { api, type Page } from "@/shared/api/client";
import { invoiceOptions } from "@/shared/lib/labels";
import {
  formatMoneyInput,
  moneyInput,
  optionalDate,
  optionalId,
  optionalRateInput,
  optionalText,
  requiredText,
} from "@/shared/lib/validation";
import {
  Button,
  CurrencySelect,
  Dialog,
  Field,
  FormError,
  Input,
  SearchInput,
  Select,
  Textarea,
  toast,
} from "@/shared/ui";

const schema = z
  .object({
    customer_id: z.string().min(1, "Müşteri seçin."),
    contact_id: optionalId,
    venue_id: optionalId,
    partner_id: z.string().min(1, "İşi getiren ortağı seçin."),
    title: requiredText(2, 200, "Teklif başlığı"),
    event_date: optionalDate,
    event_start: z.string(),
    event_end: z.string(),
    guest_count: z
      .string()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), "Pozitif bir sayı girin.")
      .transform((v) => (v === "" ? null : Number(v))),
    valid_until: optionalDate,
    invoice_type: z.enum(["with_invoice", "without_invoice"]),
    vat_rate: z
      .string()
      .refine((v) => /^\d{1,3}([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) <= 100, "0 ile 100 arasında oran girin.")
      .transform((v) => v.replace(",", ".")),
    currency: z.enum(["TRY", "EUR", "GBP", "USD"]),
    exchange_rate: optionalRateInput,
    discount_amount: moneyInput,
    advance_amount: moneyInput,
    payment_terms: optionalText(4000),
    customer_notes: optionalText(4000),
    internal_notes: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.currency !== "TRY" && !v.exchange_rate)
      ctx.addIssue({ code: "custom", path: ["exchange_rate"], message: `${v.currency} için TL kuru zorunludur.` });
    if (Boolean(v.event_start) !== Boolean(v.event_end))
      ctx.addIssue({ code: "custom", path: ["event_end"], message: "Başlangıç ve bitiş saatini birlikte girin." });
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer?: Offer | null;
  /** Müşteri detayından açılırsa müşteri önceden seçilir. */
  initialCustomerId?: number;
  onSaved?: (offer: Offer) => void;
}

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");

function useAllVenues(enabled: boolean) {
  return useQuery({
    queryKey: ["venues", "options"],
    queryFn: () => api<Page<Venue>>("/venues", { query: { limit: 200 } }),
    select: (page) => page.items,
    enabled,
  });
}

export function OfferFormDialog({ open, onOpenChange, offer, initialCustomerId, onSaved }: Props) {
  const me = useCurrentUser();
  const isEdit = Boolean(offer);
  const [customerSearch, setCustomerSearch] = useState("");
  const customers = useCustomerOptions(customerSearch);
  const partners = usePartners(false, open);
  const venues = useAllVenues(open);
  const create = useCreateOffer();
  const update = useUpdateOffer(offer?.id ?? 0);
  const mutation = isEdit ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const customerId = Number(useWatch({ control, name: "customer_id" })) || 0;
  const currency = useWatch({ control, name: "currency" });
  const suggestedRate = useSuggestedRate({
    currency: currency,
    day: undefined,
    current: useWatch({ control, name: "exchange_rate" }),
    apply: (value) => setValue("exchange_rate", value),
    enabled: open,
  });
  const customer = useCustomer(customerId);

  useEffect(() => {
    if (!open) return;
    reset({
      customer_id: String(offer?.customer.id ?? initialCustomerId ?? ""),
      contact_id: offer?.contact ? String(offer.contact.id) : "",
      venue_id: offer?.venue ? String(offer.venue.id) : "",
      partner_id: offer ? String(offer.partner.id) : String(me.partner_id ?? ""),
      title: offer?.title ?? "",
      event_date: offer?.event_date ?? "",
      event_start: hhmm(offer?.event_start),
      event_end: hhmm(offer?.event_end),
      guest_count: offer?.guest_count?.toString() ?? "",
      valid_until: offer?.valid_until ?? "",
      invoice_type: offer?.invoice_type ?? "without_invoice",
      vat_rate: offer ? String(Number(offer.vat_rate)) : "16",
      currency: offer?.currency ?? "TRY",
      exchange_rate: offer && offer.currency !== "TRY" ? String(Number(offer.exchange_rate)) : "",
      discount_amount: formatMoneyInput(offer?.discount_amount ?? "0"),
      advance_amount: formatMoneyInput(offer?.advance_amount ?? "0"),
      payment_terms: offer?.payment_terms ?? "",
      customer_notes: offer?.customer_notes ?? "",
      internal_notes: offer?.internal_notes ?? "",
    });
  }, [open, offer, initialCustomerId, me.partner_id, reset]);

  // Yeni teklifte müşteri seçilince, kullanıcı değiştirmediyse müşteri varsayılanları gelir.
  useEffect(() => {
    if (isEdit || !customer.data) return;
    if (customer.data.default_invoice && !getFieldState("invoice_type").isDirty)
      setValue("invoice_type", customer.data.default_invoice);
    if (!getFieldState("currency").isDirty) setValue("currency", customer.data.default_currency);
  }, [customer.data, isEdit, getFieldState, setValue]);

  const close = (next: boolean) => {
    if (!next) {
      create.reset();
      update.reset();
      setCustomerSearch("");
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) => {
    const body = {
      customer_id: Number(v.customer_id),
      contact_id: v.contact_id,
      venue_id: v.venue_id,
      partner_id: Number(v.partner_id),
      title: v.title,
      event_date: v.event_date,
      event_start: v.event_start || null,
      event_end: v.event_end || null,
      guest_count: v.guest_count,
      invoice_type: v.invoice_type,
      vat_rate: v.vat_rate,
      currency: v.currency,
      exchange_rate: v.currency === "TRY" ? null : v.exchange_rate,
      discount_amount: v.discount_amount,
      advance_amount: v.advance_amount,
      payment_terms: v.payment_terms,
      customer_notes: v.customer_notes,
      internal_notes: v.internal_notes,
      ...(v.valid_until ? { valid_until: v.valid_until } : {}),
    };
    const done = {
      onSuccess: (saved: Offer) => {
        toast.success(isEdit ? "Teklif güncellendi." : `${saved.offer_no} teklifi oluşturuldu.`);
        close(false);
        onSaved?.(saved);
      },
    };
    if (isEdit) update.mutate(body, done);
    else create.mutate(body, done);
  });

  const customerList = customers.data ?? [];
  const selectedMissing =
    customer.data && !customerList.some((c) => c.id === customer.data.id) ? [customer.data] : [];
  const ownVenueIds = new Set(customer.data?.venues.map((v) => v.id));

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={isEdit ? "Teklif Bilgilerini Düzenle" : "Yeni Teklif"}
      description={isEdit ? offer?.offer_no : "Satırları ve paketleri sonraki adımda ekleyeceksiniz."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="offer-form" loading={mutation.isPending}>
            {isEdit ? "Kaydet" : "Teklifi Oluştur"}
          </Button>
        </>
      }
    >
      <form id="offer-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <div className="space-y-2 sm:col-span-2">
          <Field label="Müşteri" required error={errors.customer_id?.message}>
            {(p) => (
              <Select {...p} {...register("customer_id")}>
                <option value="">Müşteri seçin</option>
                {[...selectedMissing, ...customerList].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <SearchInput value={customerSearch} onChange={setCustomerSearch} placeholder="Listede yoksa müşteri ara…" />
        </div>
        <Field label="Teklif başlığı" required error={errors.title?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("title")} placeholder="Ör. Kaya Düğün Organizasyonu" />}
        </Field>
        <Field label="İşi getiren ortak" required error={errors.partner_id?.message}>
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
        <Field label="Müşteri yetkilisi">
          {(p) => (
            <Select {...p} {...register("contact_id")} disabled={!customer.data}>
              <option value="">Belirtilmedi</option>
              {customer.data?.contacts
                .filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.title ? ` · ${c.title}` : ""}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Mekân" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("venue_id")}>
              <option value="">Belirtilmedi</option>
              {customer.data && customer.data.venues.length > 0 && (
                <optgroup label="Müşterinin mekânları">
                  {customer.data.venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Tüm mekânlar">
                {venues.data
                  ?.filter((v) => !ownVenueIds.has(v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.city ? ` · ${v.city}` : ""}
                    </option>
                  ))}
              </optgroup>
            </Select>
          )}
        </Field>
        <Field label="Etkinlik tarihi" hint="Anlaşma için zorunlu">
          {(p) => <Input {...p} {...register("event_date")} type="date" />}
        </Field>
        <Field label="Kişi sayısı" error={errors.guest_count?.message}>
          {(p) => <Input {...p} {...register("guest_count")} inputMode="numeric" />}
        </Field>
        <Field label="Başlangıç saati">{(p) => <Input {...p} {...register("event_start")} type="time" />}</Field>
        <Field label="Bitiş saati" error={errors.event_end?.message}>
          {(p) => <Input {...p} {...register("event_end")} type="time" />}
        </Field>

        <p className="pt-2 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase sm:col-span-2">Fiyatlandırma</p>
        <Field label="Para birimi" hint={isEdit ? "Satır eklendikten sonra değiştirilemez" : undefined}>
          {(p) => <CurrencySelect {...p} {...register("currency")} />}
        </Field>
        {currency !== "TRY" ? (
          <Field label={`Teklif kuru (1 ${currency} = ? TL)`} required error={errors.exchange_rate?.message} hint={suggestedRate.hint}>
            {(p) => <Input {...p} {...register("exchange_rate")} inputMode="decimal" placeholder="36,45" />}
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Field label="Fatura">
          {(p) => (
            <Select {...p} {...register("invoice_type")}>
              {invoiceOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="KDV oranı (%)" error={errors.vat_rate?.message} hint="Sadece faturalı işte uygulanır">
          {(p) => <Input {...p} {...register("vat_rate")} inputMode="decimal" />}
        </Field>
        {isEdit && (
          <>
            <Field label={`İndirim (${currency})`} error={errors.discount_amount?.message}>
              {(p) => <Input {...p} {...register("discount_amount")} inputMode="decimal" />}
            </Field>
            <Field label={`Ön ödeme / kapora (${currency})`} error={errors.advance_amount?.message}>
              {(p) => <Input {...p} {...register("advance_amount")} inputMode="decimal" />}
            </Field>
            <Field label="Geçerlilik tarihi">
              {(p) => <Input {...p} {...register("valid_until")} type="date" />}
            </Field>
          </>
        )}
        <Field label="Ödeme şartları" hint="Boş bırakılırsa firma ayarlarındaki metin kullanılır" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("payment_terms")} className="min-h-16" />}
        </Field>
        <Field label="Müşteriye not" hint="Teklif çıktısında görünür" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("customer_notes")} className="min-h-16" />}
        </Field>
        <Field label="İç not" hint="Müşteri görmez" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("internal_notes")} className="min-h-16" />}
        </Field>
        <FormError error={mutation.error} />
      </form>
    </Dialog>
  );
}
