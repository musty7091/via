import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import {
  useCatalogOptions,
  usePackageItemMutations,
  type Artist,
  type PackageItem,
  type Service,
} from "@/features/catalog/api";
import { componentTypeOptions, programSectionOptions } from "@/shared/lib/labels";
import { formatMoneyInput, optionalMoneyInput, optionalText } from "@/shared/lib/validation";
import { Button, Checkbox, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z
  .object({
    component_type: z.enum(["artist", "service", "custom"]),
    artist_id: z.string(),
    service_id: z.string(),
    title: optionalText(160),
    program_section: z.enum(["opening", "warmup", "main", "support", "closing", "technical", "other"]),
    start_time: z.string(),
    end_time: z.string(),
    quantity: z
      .string()
      .refine((v) => /^\d+([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) > 0, "Sıfırdan büyük bir miktar girin.")
      .transform((v) => v.replace(",", ".")),
    unit_cost: optionalMoneyInput,
    cost_currency: z.enum(["", "TRY", "EUR", "GBP", "USD"]),
    is_visible_on_offer: z.boolean(),
    notes: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.component_type === "artist" && !v.artist_id) ctx.addIssue({ code: "custom", path: ["artist_id"], message: "Sanatçı seçin." });
    if (v.component_type === "service" && !v.service_id) ctx.addIssue({ code: "custom", path: ["service_id"], message: "Hizmet seçin." });
    if (v.component_type === "custom" && !v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Serbest kalem için başlık zorunludur." });
    if (Boolean(v.start_time) !== Boolean(v.end_time))
      ctx.addIssue({ code: "custom", path: ["end_time"], message: "Başlangıç ve bitiş saatini birlikte girin." });
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  packageId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PackageItem | null;
}

const hhmm = (value: string | null | undefined) => (value ? value.slice(0, 5) : "");

export function PackageItemDialog({ packageId, open, onOpenChange, item }: Props) {
  const can = useCan();
  const showCosts = can("costs.view");
  const isEdit = Boolean(item);
  const artists = useCatalogOptions<Artist>("artists", open && !isEdit);
  const services = useCatalogOptions<Service>("services", open && !isEdit);
  const { save } = usePackageItemMutations(packageId);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });
  const componentType = useWatch({ control, name: "component_type" });

  useEffect(() => {
    if (!open) return;
    reset({
      component_type: item?.component_type ?? "artist",
      artist_id: item?.artist_id ? String(item.artist_id) : "",
      service_id: item?.service_id ? String(item.service_id) : "",
      title: item?.title ?? "",
      program_section: item?.program_section ?? "main",
      start_time: hhmm(item?.start_time),
      end_time: hhmm(item?.end_time),
      quantity: item?.quantity ?? "1",
      unit_cost: formatMoneyInput(item?.unit_cost),
      cost_currency: item?.cost_currency ?? "",
      is_visible_on_offer: item?.is_visible_on_offer ?? true,
      notes: item?.notes ?? "",
    });
  }, [open, item, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) => {
    const common = {
      title: v.title,
      program_section: v.program_section,
      start_time: v.start_time || null,
      end_time: v.end_time || null,
      quantity: v.quantity,
      is_visible_on_offer: v.is_visible_on_offer,
      notes: v.notes,
      ...(showCosts ? { unit_cost: v.unit_cost, cost_currency: v.cost_currency || null } : {}),
    };
    const body = item
      ? common
      : {
          ...common,
          component_type: v.component_type,
          artist_id: v.component_type === "artist" ? Number(v.artist_id) : null,
          service_id: v.component_type === "service" ? Number(v.service_id) : null,
        };
    save.mutate(
      { id: item?.id, body },
      {
        onSuccess: () => {
          toast.success(item ? "Kalem güncellendi." : "Kalem pakete eklendi.");
          close(false);
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={item ? "Program Kalemini Düzenle" : "Program Kalemi Ekle"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="package-item-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="package-item-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {!isEdit && (
          <>
            <Field label="Kalem türü">
              {(p) => (
                <Select {...p} {...register("component_type")}>
                  {componentTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {componentType === "artist" && (
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
            {componentType === "service" && (
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
          required={componentType === "custom"}
          hint={componentType === "custom" ? undefined : "Boş bırakılırsa sanatçı/hizmet adı kullanılır"}
          error={errors.title?.message}
          className="sm:col-span-2"
        >
          {(p) => <Input {...p} {...register("title")} />}
        </Field>
        <Field label="Program bölümü">
          {(p) => (
            <Select {...p} {...register("program_section")}>
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
        {showCosts && (
          <>
            <Field
              label="Birim maliyet"
              hint={isEdit ? undefined : "Boş bırakılırsa varsayılan maliyet kullanılır"}
              error={errors.unit_cost?.message}
            >
              {(p) => <Input {...p} {...register("unit_cost")} inputMode="decimal" />}
            </Field>
            <Field label="Maliyet para birimi">
              {(p) => (
                <CurrencySelect
                  {...p}
                  {...register("cost_currency")}
                  emptyLabel={isEdit ? undefined : "Sanatçı/hizmetin para birimi"}
                />
              )}
            </Field>
          </>
        )}
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} className="min-h-16" />}
        </Field>
        <Checkbox
          {...register("is_visible_on_offer")}
          label="Teklifte müşteriye göster"
          description="Kapalıysa sadece iç maliyet olarak tutulur (ör. ekip yemeği)."
          className="sm:col-span-2"
        />
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
