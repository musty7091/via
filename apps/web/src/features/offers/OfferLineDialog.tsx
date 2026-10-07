import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import { useCatalogOptions, type Artist, type Service } from "@/features/catalog/api";
import { useOfferLines, type Offer, type OfferLine } from "@/features/offers/api";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { programSectionOptions } from "@/shared/lib/labels";
import {
  formatMoneyInput,
  optionalMoneyInput,
  optionalRateInput,
  optionalText,
} from "@/shared/lib/validation";
import { Button, Checkbox, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z
  .object({
    line_type: z.enum(["artist", "service", "custom"]),
    artist_id: z.string(),
    service_id: z.string(),
    title: optionalText(200),
    description: optionalText(4000),
    program_section: z.enum(["", "opening", "warmup", "main", "support", "closing", "technical", "other"]),
    start_time: z.string(),
    end_time: z.string(),
    quantity: z
      .string()
      .refine((v) => /^\d+([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) > 0, "Sıfırdan büyük bir miktar girin.")
      .transform((v) => v.replace(",", ".")),
    unit_price: optionalMoneyInput,
    unit_cost: optionalMoneyInput,
    cost_currency: z.enum(["", "TRY", "EUR", "GBP", "USD"]),
    cost_rate: optionalRateInput,
    is_visible: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.line_type === "artist" && !v.artist_id) ctx.addIssue({ code: "custom", path: ["artist_id"], message: "Sanatçı seçin." });
    if (v.line_type === "service" && !v.service_id) ctx.addIssue({ code: "custom", path: ["service_id"], message: "Hizmet seçin." });
    if (v.line_type === "custom" && !v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Başlık zorunludur." });
    if (Boolean(v.start_time) !== Boolean(v.end_time))
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "Başlangıç ve bitiş saatini birlikte girin." });
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  offer: Offer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  line?: OfferLine | null;
}

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");

export function OfferLineDialog({ offer, open, onOpenChange, line }: Props) {
  const can = useCan();
  const showCosts = can("costs.view");
  const isEdit = Boolean(line);
  const isComponent = line?.line_type === "package_component";
  const isPackage = line?.line_type === "package";
  const artists = useCatalogOptions<Artist>("artists", open && !isEdit);
  const services = useCatalogOptions<Service>("services", open && !isEdit);
  const { add, update } = useOfferLines(offer.id);
  const mutation = isEdit ? update : add;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const lineType = useWatch({ control, name: "line_type" });
  const costCurrency = useWatch({ control, name: "cost_currency" });

  useEffect(() => {
    if (!open) return;
    reset({
      line_type: line && ["artist", "service", "custom"].includes(line.line_type) ? (line.line_type as "artist") : "artist",
      artist_id: line?.artist_id ? String(line.artist_id) : "",
      service_id: line?.service_id ? String(line.service_id) : "",
      title: line?.title ?? "",
      description: line?.description ?? "",
      program_section: line?.program_section ?? "",
      start_time: hhmm(line?.start_time),
      end_time: hhmm(line?.end_time),
      quantity: line ? String(Number(line.quantity)) : "1",
      unit_price: line ? formatMoneyInput(line.unit_price) : "",
      unit_cost: line?.unit_cost != null ? formatMoneyInput(line.unit_cost) : "",
      cost_currency: line?.cost_currency ?? "",
      cost_rate: line?.cost_rate && line.cost_currency !== "TRY" ? String(Number(line.cost_rate)) : "",
      is_visible: line?.is_visible ?? true,
    });
  }, [open, line, reset]);

  const close = (next: boolean) => {
    if (!next) mutation.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) => {
    const common = {
      title: v.title,
      description: v.description,
      program_section: v.program_section || null,
      start_time: v.start_time || null,
      end_time: v.end_time || null,
      quantity: v.quantity,
      is_visible: v.is_visible,
      ...(isComponent ? {} : v.unit_price !== null ? { unit_price: v.unit_price } : {}),
      ...(showCosts
        ? {
            ...(v.unit_cost !== null ? { unit_cost: v.unit_cost } : {}),
            ...(v.cost_currency ? { cost_currency: v.cost_currency } : {}),
            // Kur sadece alan görünürken gönderilir; teklif dövizindeki maliyet teklif kurunu izler.
            ...(needsCostRate && v.cost_rate ? { cost_rate: v.cost_rate } : {}),
          }
        : {}),
    };
    const done = {
      onSuccess: () => {
        toast.success(isEdit ? "Satır güncellendi." : "Satır eklendi.");
        close(false);
      },
    };
    if (line) {
      update.mutate({ id: line.id, body: common }, done);
    } else {
      add.mutate(
        {
          ...common,
          line_type: v.line_type,
          artist_id: v.line_type === "artist" ? Number(v.artist_id) : null,
          service_id: v.line_type === "service" ? Number(v.service_id) : null,
        },
        done,
      );
    }
  });

  const effectiveCostCurrency = costCurrency || (isEdit ? line?.cost_currency : "");
  const needsCostRate =
    showCosts && effectiveCostCurrency && effectiveCostCurrency !== "TRY" && effectiveCostCurrency !== offer.currency;
  const suggestedRate = useSuggestedRate({
    currency: effectiveCostCurrency || undefined,
    day: undefined,
    current: useWatch({ control, name: "cost_rate" }),
    apply: (value) => setValue("cost_rate", value),
    enabled: open && Boolean(needsCostRate),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={isEdit ? "Satırı Düzenle" : "Satır Ekle"}
      description={
        isComponent
          ? "Paket içeriği ayrıca fiyatlandırılmaz; müşteriye 'Dahil' olarak görünür."
          : `Fiyatlar teklif para biriminde (${offer.currency}).`
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="offer-line-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="offer-line-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {!isEdit && (
          <>
            <Field label="Satır türü">
              {(p) => (
                <Select {...p} {...register("line_type")}>
                  <option value="artist">Sanatçı</option>
                  <option value="service">Hizmet</option>
                  <option value="custom">Serbest satır</option>
                </Select>
              )}
            </Field>
            {lineType === "artist" && (
              <Field label="Sanatçı" required error={errors.artist_id?.message}>
                {(p) => (
                  <Select {...p} {...register("artist_id")}>
                    <option value="">Seçin</option>
                    {artists.data?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {lineType === "service" && (
              <Field label="Hizmet" required error={errors.service_id?.message}>
                {(p) => (
                  <Select {...p} {...register("service_id")}>
                    <option value="">Seçin</option>
                    {services.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </>
        )}
        <Field
          label="Başlık"
          required={lineType === "custom" || isEdit}
          hint={!isEdit && lineType !== "custom" ? "Boş bırakılırsa sanatçı/hizmet adı kullanılır" : undefined}
          error={errors.title?.message}
          className="sm:col-span-2"
        >
          {(p) => <Input {...p} {...register("title")} />}
        </Field>
        <Field label="Açıklama" hint="Teklifte başlığın altında görünür" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("description")} className="min-h-16" />}
        </Field>
        {!isPackage && (
          <>
            <Field label="Program bölümü">
              {(p) => (
                <Select {...p} {...register("program_section")}>
                  <option value="">Otomatik</option>
                  {programSectionOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Miktar" error={errors.quantity?.message}>
              {(p) => <Input {...p} {...register("quantity")} inputMode="decimal" />}
            </Field>
            <Field label="Başlangıç saati">{(p) => <Input {...p} {...register("start_time")} type="time" />}</Field>
            <Field label="Bitiş saati" error={errors.end_time?.message}>
              {(p) => <Input {...p} {...register("end_time")} type="time" />}
            </Field>
          </>
        )}
        {!isComponent && (
          <Field
            label={`Birim satış fiyatı (${offer.currency})`}
            hint={!isEdit ? "Boş bırakılırsa katalog fiyatı kullanılır (aynı para birimindeyse)" : undefined}
            error={errors.unit_price?.message}
            className="sm:col-span-2"
          >
            {(p) => <Input {...p} {...register("unit_price")} inputMode="decimal" />}
          </Field>
        )}
        {showCosts && !isPackage && (
          <>
            <Field label="Birim maliyet" hint={!isEdit ? "Boş bırakılırsa katalog maliyeti" : undefined} error={errors.unit_cost?.message}>
              {(p) => <Input {...p} {...register("unit_cost")} inputMode="decimal" />}
            </Field>
            <Field label="Maliyet para birimi">
              {(p) => <CurrencySelect {...p} {...register("cost_currency")} emptyLabel={isEdit ? undefined : "Katalogdaki para birimi"} />}
            </Field>
            {needsCostRate && (
              <Field label={`Maliyet kuru (1 ${effectiveCostCurrency} = ? TL)`} error={errors.cost_rate?.message} hint={suggestedRate.hint} className="sm:col-span-2">
                {(p) => <Input {...p} {...register("cost_rate")} inputMode="decimal" />}
              </Field>
            )}
          </>
        )}
        {!isPackage && (
          <Checkbox
            {...register("is_visible")}
            label="Müşteriye göster"
            description="Kapalıysa satır teklif çıktısında görünmez ve fiyatı olamaz (iç maliyet)."
            className="sm:col-span-2"
          />
        )}
        <FormError error={mutation.error} />
      </form>
    </Dialog>
  );
}
