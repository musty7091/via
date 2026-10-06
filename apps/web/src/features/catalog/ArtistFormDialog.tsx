import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import { useSaveCatalog, type Artist, type ArtistCreate, type ArtistDetail, type ArtistUpdate } from "@/features/catalog/api";
import { usePartners } from "@/features/partners/api";
import { artistTypeOptions } from "@/shared/lib/labels";
import {
  formatMoneyInput,
  optionalEmail,
  optionalId,
  optionalMoneyInput,
  optionalText,
  requiredText,
} from "@/shared/lib/validation";
import { Button, Checkbox, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const currency = z.enum(["TRY", "EUR", "GBP", "USD"]);

const schema = z.object({
  artist_type: z.enum(["solo", "band", "dj", "dancer", "dance_group", "presenter", "other"]),
  name: requiredText(2, 160, "Ad"),
  manager_partner_id: optionalId,
  contact_name: optionalText(120),
  phone: optionalText(40),
  email: optionalEmail,
  iban: optionalText(40),
  default_cost: optionalMoneyInput,
  cost_currency: currency,
  default_price: optionalMoneyInput,
  price_currency: currency,
  notes: optionalText(4000),
  is_active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist?: Artist | null;
  onSaved?: (artist: ArtistDetail) => void;
}

export function ArtistFormDialog({ open, onOpenChange, artist, onSaved }: Props) {
  const can = useCan();
  const showCosts = can("costs.view");
  const partners = usePartners(false, open);
  const save = useSaveCatalog<ArtistCreate | ArtistUpdate, ArtistDetail>("artists");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      artist_type: artist?.artist_type ?? "solo",
      name: artist?.name ?? "",
      manager_partner_id: artist?.manager_partner_id ? String(artist.manager_partner_id) : "",
      contact_name: artist?.contact_name ?? "",
      phone: artist?.phone ?? "",
      email: artist?.email ?? "",
      iban: artist?.iban ?? "",
      default_cost: formatMoneyInput(artist?.default_cost),
      cost_currency: artist?.cost_currency ?? "TRY",
      default_price: formatMoneyInput(artist?.default_price),
      price_currency: artist?.price_currency ?? "TRY",
      notes: artist?.notes ?? "",
      is_active: artist?.is_active ?? true,
    });
  }, [open, artist, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, default_cost, cost_currency, iban, ...values }) => {
    // Maliyet görmeyen kullanıcı bu alanları göndermez; mevcut değerler korunur.
    const costs = showCosts ? { default_cost, cost_currency, iban } : {};
    const body = artist ? { ...values, ...costs, is_active } : { ...values, ...costs };
    save.mutate(
      { id: artist?.id, body },
      {
        onSuccess: (saved) => {
          toast.success(artist ? "Sanatçı güncellendi." : "Sanatçı eklendi.");
          close(false);
          onSaved?.(saved);
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={artist ? "Sanatçıyı Düzenle" : "Yeni Sanatçı"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="artist-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="artist-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Ad / sahne adı" required error={errors.name?.message}>
          {(p) => <Input {...p} {...register("name")} />}
        </Field>
        <Field label="Tür" required>
          {(p) => (
            <Select {...p} {...register("artist_type")}>
              {artistTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Menajer ortak" hint="Sanatçıyla ilişkiyi yöneten ortak" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("manager_partner_id")}>
              <option value="">Belirtilmedi</option>
              {partners.data?.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.full_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="İletişim kişisi" hint="Menajer, asistan vb.">
          {(p) => <Input {...p} {...register("contact_name")} />}
        </Field>
        <Field label="Telefon">{(p) => <Input {...p} {...register("phone")} type="tel" />}</Field>
        <Field label="E-posta" error={errors.email?.message}>
          {(p) => <Input {...p} {...register("email")} type="email" />}
        </Field>
        {showCosts && (
          <Field label="IBAN" hint="Ödeme yapılırken kullanılır">
            {(p) => <Input {...p} {...register("iban")} autoComplete="off" />}
          </Field>
        )}

        <p className="pt-2 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase sm:col-span-2">
          Varsayılan fiyatlar · teklif ve pakette öneri olarak gelir
        </p>
        {showCosts && (
          <>
            <Field label="Maliyet (sanatçıya ödenen)" error={errors.default_cost?.message}>
              {(p) => <Input {...p} {...register("default_cost")} inputMode="decimal" placeholder="0" />}
            </Field>
            <Field label="Maliyet para birimi">{(p) => <CurrencySelect {...p} {...register("cost_currency")} />}</Field>
          </>
        )}
        <Field label="Satış fiyatı (müşteriye)" error={errors.default_price?.message}>
          {(p) => <Input {...p} {...register("default_price")} inputMode="decimal" placeholder="0" />}
        </Field>
        <Field label="Satış para birimi">{(p) => <CurrencySelect {...p} {...register("price_currency")} />}</Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} />}
        </Field>
        {artist && <Checkbox {...register("is_active")} label="Aktif" description="Pasif sanatçı yeni paket ve tekliflere eklenemez." className="sm:col-span-2" />}
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
