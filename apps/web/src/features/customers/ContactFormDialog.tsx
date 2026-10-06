import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useSaveContact, type Contact } from "@/features/customers/api";
import { optionalEmail, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, FormError, Input, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  full_name: requiredText(2, 120, "Ad soyad"),
  title: optionalText(80),
  phone: optionalText(40),
  email: optionalEmail,
  is_primary: z.boolean(),
  is_accounting: z.boolean(),
  is_operation: z.boolean(),
  is_active: z.boolean(),
  notes: optionalText(4000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  customerId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
}

export function ContactFormDialog({ customerId, open, onOpenChange, contact }: Props) {
  const save = useSaveContact(customerId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      full_name: contact?.full_name ?? "",
      title: contact?.title ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      is_primary: contact?.is_primary ?? false,
      is_accounting: contact?.is_accounting ?? false,
      is_operation: contact?.is_operation ?? false,
      is_active: contact?.is_active ?? true,
      notes: contact?.notes ?? "",
    });
  }, [open, contact, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, ...values }) =>
    save.mutate(
      { id: contact?.id, body: contact ? { ...values, is_active } : values },
      {
        onSuccess: () => {
          toast.success(contact ? "Yetkili güncellendi." : "Yetkili eklendi.");
          close(false);
        },
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={contact ? "Yetkiliyi Düzenle" : "Yeni Yetkili"}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="contact-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Ad soyad" required error={errors.full_name?.message}>
          {(p) => <Input {...p} {...register("full_name")} />}
        </Field>
        <Field label="Unvan">{(p) => <Input {...p} {...register("title")} placeholder="Ör. Etkinlik Müdürü" />}</Field>
        <Field label="Telefon">{(p) => <Input {...p} {...register("phone")} type="tel" />}</Field>
        <Field label="E-posta" error={errors.email?.message}>
          {(p) => <Input {...p} {...register("email")} type="email" />}
        </Field>
        <div className="space-y-3 sm:col-span-2">
          <Checkbox {...register("is_primary")} label="Ana yetkili" description="Listelerde ve tekliflerde ilk bu kişi görünür." />
          <Checkbox {...register("is_accounting")} label="Muhasebe / ödeme yetkilisi" />
          <Checkbox {...register("is_operation")} label="Operasyon yetkilisi" description="Etkinlik günü iletişim kurulacak kişi." />
          {contact && <Checkbox {...register("is_active")} label="Aktif" />}
        </div>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} />}
        </Field>
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}
