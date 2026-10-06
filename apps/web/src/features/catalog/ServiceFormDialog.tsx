import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import {
  useCatalogOptions,
  useSaveCatalog,
  type Service,
  type ServiceCreate,
  type ServiceUpdate,
  type Supplier,
} from "@/features/catalog/api";
import { serviceTypeOptions, serviceUnitOptions } from "@/shared/lib/labels";
import { formatMoneyInput, optionalId, optionalMoneyInput, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const currency = z.enum(["TRY", "EUR", "GBP", "USD"]);

const schema = z.object({
  service_type: z.enum(["sound", "light", "stage", "screen", "photo_video", "decoration", "catering", "transport", "staff", "other"]),
  name: requiredText(2, 160, "Hizmet adı"),
  unit: z.enum(["piece", "day", "hour", "person", "set"]),
  supplier_id: optionalId,
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
  service?: Service | null;
}

export function ServiceFormDialog({ open, onOpenChange, service }: Props) {
  const can = useCan();
  const showCosts = can("costs.view");
  const suppliers = useCatalogOptions<Supplier>("suppliers", open && showCosts);
  const save = useSaveCatalog<ServiceCreate | ServiceUpdate, Service>("services");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      service_type: service?.service_type ?? "sound",
      name: service?.name ?? "",
      unit: service?.unit ?? "piece",
      supplier_id: service?.supplier_id ? String(service.supplier_id) : "",
      default_cost: formatMoneyInput(service?.default_cost),
      cost_currency: service?.cost_currency ?? "TRY",
      default_price: formatMoneyInput(service?.default_price),
      price_currency: service?.price_currency ?? "TRY",
      notes: service?.notes ?? "",
      is_active: service?.is_active ?? true,
    });
  }, [open, service, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, default_cost, cost_currency, supplier_id, ...values }) => {
    const costs = showCosts ? { default_cost, cost_currency, supplier_id } : {};
    const body = service ? { ...values, ...costs, is_active } : { ...values, ...costs };
    save.mutate(
      { id: service?.id, body },
      {
        onSuccess: () => {
          toast.success(service ? "Hizmet güncellendi." : "Hizmet eklendi.");
          close(false);
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={service ? "Hizmeti Düzenle" : "Yeni Hizmet"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="service-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Hizmet adı" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} placeholder="Ör. Bang Olufsen Ses Sistemi" />}
        </Field>
        <Field label="Tür" required>
          {(p) => (
            <Select {...p} {...register("service_type")}>
              {serviceTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Birim">
          {(p) => (
            <Select {...p} {...register("unit")}>
              {serviceUnitOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {showCosts && (
          <Field label="Tedarikçi" hint="Hizmeti sağlayan ve ödeme yapılacak firma" className="sm:col-span-2">
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
        <p className="pt-2 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase sm:col-span-2">
          Birim başına varsayılan fiyatlar
        </p>
        {showCosts && (
          <>
            <Field label="Maliyet" error={errors.default_cost?.message}>
              {(p) => <Input {...p} {...register("default_cost")} inputMode="decimal" placeholder="0" />}
            </Field>
            <Field label="Maliyet para birimi">{(p) => <CurrencySelect {...p} {...register("cost_currency")} />}</Field>
          </>
        )}
        <Field label="Satış fiyatı" error={errors.default_price?.message}>
          {(p) => <Input {...p} {...register("default_price")} inputMode="decimal" placeholder="0" />}
        </Field>
        <Field label="Satış para birimi">{(p) => <CurrencySelect {...p} {...register("price_currency")} />}</Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} />}
        </Field>
        {service && <Checkbox {...register("is_active")} label="Aktif" className="sm:col-span-2" />}
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
