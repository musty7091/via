import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateRiderCheck } from "@/features/operations/api";
import { riderCategoryOptions } from "@/shared/lib/labels";
import { optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  title: requiredText(2, 200, "Şart"),
  category: z.enum(["technical", "backstage", "hospitality", "transport", "other"]),
  description: optionalText(4000),
  is_required: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

/** Sadece bu etkinliğe özel ek şart (katalogdaki rider'ı değiştirmez). */
export function RiderCheckDialog({ eventId, open, onOpenChange }: { eventId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateRiderCheck(eventId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ title: "", category: "other", description: "", is_required: true });
  }, [open, reset]);

  const close = (next: boolean) => {
    if (!next) create.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Şart eklendi.");
        close(false);
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Şart Ekle"
      description="Sadece bu etkinliğin kontrol listesine eklenir."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="rider-check-form" loading={create.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="rider-check-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        <Field label="Şart" required error={errors.title?.message}>
          {(p) => <Input {...p} {...register("title")} placeholder="Ör. Gelin odası için ayna" />}
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
        <Field label="Açıklama">{(p) => <Textarea {...p} {...register("description")} />}</Field>
        <Checkbox {...register("is_required")} label="Zorunlu şart" />
        <FormError error={create.error} />
      </form>
    </Dialog>
  );
}
