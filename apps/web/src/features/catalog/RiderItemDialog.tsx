import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useSaveRiderItem, type RiderItem } from "@/features/catalog/api";
import { riderCategoryOptions } from "@/shared/lib/labels";
import { optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  category: z.enum(["technical", "backstage", "hospitality", "transport", "other"]),
  title: requiredText(2, 160, "Şart"),
  description: optionalText(4000),
  is_required: z.boolean(),
  sort_order: z.coerce.number<string>().int("Tam sayı girin."),
  is_active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  artistId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: RiderItem | null;
  nextSortOrder: number;
}

export function RiderItemDialog({ artistId, open, onOpenChange, item, nextSortOrder }: Props) {
  const save = useSaveRiderItem(artistId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      category: item?.category ?? "technical",
      title: item?.title ?? "",
      description: item?.description ?? "",
      is_required: item?.is_required ?? true,
      sort_order: String(item?.sort_order ?? nextSortOrder),
      is_active: item?.is_active ?? true,
    });
  }, [open, item, nextSortOrder, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, ...values }) =>
    save.mutate(
      { id: item?.id, body: item ? { ...values, is_active } : values },
      {
        onSuccess: () => {
          toast.success(item ? "Rider şartı güncellendi." : "Rider şartı eklendi.");
          close(false);
        },
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={item ? "Rider Şartını Düzenle" : "Rider Şartı Ekle"}
      description="Etkinlikte operasyon ekibinin kontrol listesine kopyalanır."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="rider-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="rider-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Şart" required error={errors.title?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("title")} placeholder="Ör. Sahnede 2 adet monitör" />}
        </Field>
        <Field label="Kategori">
          {(p) => (
            <Select {...p} {...register("category")}>
              {riderCategoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sıra" error={errors.sort_order?.message}>
          {(p) => <Input {...p} {...register("sort_order")} inputMode="numeric" />}
        </Field>
        <Field label="Açıklama" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("description")} />}
        </Field>
        <Checkbox {...register("is_required")} label="Zorunlu şart" description="Karşılanmazsa etkinlik öncesi uyarı verilir." className="sm:col-span-2" />
        {item && <Checkbox {...register("is_active")} label="Aktif" className="sm:col-span-2" />}
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
