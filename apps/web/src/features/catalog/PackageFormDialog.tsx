import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import { useSaveCatalog, type PackageCreate, type PackageDetail, type PackageUpdate } from "@/features/catalog/api";
import { packageTypeOptions } from "@/shared/lib/labels";
import { formatMoneyInput, moneyInput, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, CurrencySelect, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  package_type: z.enum(["program", "technical", "combo"]),
  name: requiredText(2, 160, "Paket adı"),
  description: optionalText(4000),
  internal_notes: optionalText(4000),
  price: moneyInput,
  currency: z.enum(["TRY", "EUR", "GBP", "USD"]),
  is_active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg?: PackageDetail | null;
  onSaved?: (pkg: PackageDetail) => void;
}

export function PackageFormDialog({ open, onOpenChange, pkg, onSaved }: Props) {
  const can = useCan();
  const showInternal = can("costs.view");
  const save = useSaveCatalog<PackageCreate | PackageUpdate, PackageDetail>("packages");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      package_type: pkg?.package_type ?? "combo",
      name: pkg?.name ?? "",
      description: pkg?.description ?? "",
      internal_notes: pkg?.internal_notes ?? "",
      price: formatMoneyInput(pkg?.price),
      currency: pkg?.currency ?? "TRY",
      is_active: pkg?.is_active ?? true,
    });
  }, [open, pkg, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, internal_notes, ...values }) => {
    const internal = showInternal ? { internal_notes } : {};
    const body = pkg ? { ...values, ...internal, is_active } : { ...values, ...internal };
    save.mutate(
      { id: pkg?.id, body },
      {
        onSuccess: (saved) => {
          toast.success(pkg ? "Paket güncellendi." : "Paket oluşturuldu.");
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
      title={pkg ? "Paketi Düzenle" : "Yeni Paket"}
      description="Paket müşteriye tek fiyatla satılır; içindeki kalemler fiyatsız program akışı olarak görünür."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="package-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="package-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Paket adı" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} placeholder="Ör. Yaza Merhaba Paketi" />}
        </Field>
        <Field label="Paket türü" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("package_type")}>
              {packageTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Satış fiyatı" required error={errors.price?.message}>
          {(p) => <Input {...p} {...register("price")} inputMode="decimal" placeholder="300.000" />}
        </Field>
        <Field label="Para birimi">{(p) => <CurrencySelect {...p} {...register("currency")} />}</Field>
        <Field label="Açıklama" hint="Teklifte müşteriye görünür" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("description")} />}
        </Field>
        {showInternal && (
          <Field label="İç not" hint="Müşteri görmez" className="sm:col-span-2">
            {(p) => <Textarea {...p} {...register("internal_notes")} className="min-h-16" />}
          </Field>
        )}
        {pkg && <Checkbox {...register("is_active")} label="Aktif" description="Pasif paket yeni tekliflere eklenemez." className="sm:col-span-2" />}
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
