import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCustomerOptions, useSaveVenue, type Venue } from "@/features/customers/api";
import { venueTypeOptions } from "@/shared/lib/labels";
import { optionalId, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  name: requiredText(2, 160, "Mekân adı"),
  venue_type: z.enum(["hotel", "restaurant", "hall", "beach", "open_air", "club", "other"]),
  customer_id: optionalId,
  city: optionalText(80),
  district: optionalText(80),
  address: optionalText(4000),
  capacity: z
    .string()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), "Pozitif bir sayı girin.")
    .transform((v) => (v === "" ? null : Number(v))),
  contact_name: optionalText(120),
  contact_phone: optionalText(40),
  technical_notes: optionalText(4000),
  notes: optionalText(4000),
  is_active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue?: Venue | null;
  /** Müşteri detayından açılırsa müşteri sabitlenir. */
  fixedCustomer?: { id: number; name: string };
}

export function VenueFormDialog({ open, onOpenChange, venue, fixedCustomer }: Props) {
  const save = useSaveVenue();
  const customers = useCustomerOptions();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    const customerId = fixedCustomer?.id ?? venue?.customer_id;
    reset({
      name: venue?.name ?? "",
      venue_type: venue?.venue_type ?? "hall",
      customer_id: customerId ? String(customerId) : "",
      city: venue?.city ?? "",
      district: venue?.district ?? "",
      address: venue?.address ?? "",
      capacity: venue?.capacity?.toString() ?? "",
      contact_name: venue?.contact_name ?? "",
      contact_phone: venue?.contact_phone ?? "",
      technical_notes: venue?.technical_notes ?? "",
      notes: venue?.notes ?? "",
      is_active: venue?.is_active ?? true,
    });
  }, [open, venue, fixedCustomer, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, ...values }) =>
    save.mutate(
      { id: venue?.id, body: venue ? { ...values, is_active } : values },
      {
        onSuccess: () => {
          toast.success(venue ? "Mekân güncellendi." : "Mekân eklendi.");
          close(false);
        },
      },
    ),
  );

  // Seçili müşteri, ilk 50 sonuç arasında olmasa bile listede görünsün.
  const customerList = customers.data ?? [];
  const currentCustomer = venue?.customer_id && !customerList.some((c) => c.id === venue.customer_id)
    ? [{ id: venue.customer_id, name: venue.customer_name ?? "Mevcut müşteri" }]
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={venue ? "Mekânı Düzenle" : "Yeni Mekân"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="venue-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="venue-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Mekân adı" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} placeholder="Ör. Merit Park Balo Salonu" />}
        </Field>
        <Field label="Mekân türü" required>
          {(p) => (
            <Select {...p} {...register("venue_type")}>
              {venueTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {fixedCustomer ? (
          <Field label="Bağlı müşteri">{(p) => <Input {...p} value={fixedCustomer.name} disabled />}</Field>
        ) : (
          <Field label="Bağlı müşteri" hint="Mekân bir müşteriye aitse (ör. otelin kendi salonu)">
            {(p) => (
              <Select {...p} {...register("customer_id")}>
                <option value="">Bağımsız mekân</option>
                {[...currentCustomer, ...customerList].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Şehir">{(p) => <Input {...p} {...register("city")} />}</Field>
        <Field label="İlçe / bölge">{(p) => <Input {...p} {...register("district")} />}</Field>
        <Field label="Adres" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("address")} className="min-h-16" />}
        </Field>
        <Field label="Kapasite (kişi)" error={errors.capacity?.message}>
          {(p) => <Input {...p} {...register("capacity")} inputMode="numeric" />}
        </Field>
        <div className="hidden sm:block" />
        <Field label="Mekân yetkilisi">{(p) => <Input {...p} {...register("contact_name")} />}</Field>
        <Field label="Yetkili telefonu">{(p) => <Input {...p} {...register("contact_phone")} type="tel" />}</Field>
        <Field label="Teknik notlar" hint="Sahne ölçüsü, elektrik, yükleme kapısı..." className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("technical_notes")} />}
        </Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} className="min-h-16" />}
        </Field>
        {venue && <Checkbox {...register("is_active")} label="Aktif" className="sm:col-span-2" />}
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
