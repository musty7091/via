import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import { useCreatePartner, useUpdatePartner, type Partner } from "@/features/partners/api";
import { useUserOptions } from "@/features/users/api";
import { errorMessage } from "@/shared/api/client";
import { optionalText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  full_name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalıdır."),
  phone: optionalText(40),
  email: z
    .union([z.literal(""), z.email("Geçerli bir e-posta adresi girin.")])
    .transform((value) => (value === "" ? null : value)),
  sort_order: z.coerce.number<string>().int("Tam sayı girin.").min(0, "Negatif olamaz."),
  user_id: z.string().transform((value) => (value === "" ? null : Number(value))),
  is_active: z.boolean(),
  notes: optionalText(2000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: Partner | null;
  nextSortOrder: number;
}

export function PartnerFormDialog({ open, onOpenChange, partner, nextSortOrder }: Props) {
  const can = useCan();
  const canLinkUser = can("users.manage");
  const users = useUserOptions(open && canLinkUser);
  const create = useCreatePartner();
  const update = useUpdatePartner();
  const mutation = partner ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      full_name: partner?.full_name ?? "",
      phone: partner?.phone ?? "",
      email: partner?.email ?? "",
      sort_order: String(partner?.sort_order ?? nextSortOrder),
      user_id: partner?.user_id ? String(partner.user_id) : "",
      is_active: partner?.is_active ?? true,
      notes: partner?.notes ?? "",
    });
  }, [open, partner, nextSortOrder, reset]);

  const close = (next: boolean) => {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ user_id, ...values }) => {
    const body = canLinkUser ? { ...values, user_id } : values;
    const done = {
      onSuccess: () => {
        toast.success(partner ? "Ortak bilgileri güncellendi." : "Ortak eklendi.");
        close(false);
      },
    };
    if (partner) update.mutate({ id: partner.id, body }, done);
    else create.mutate(body, done);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={partner ? "Ortağı Düzenle" : "Yeni Ortak"}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="partner-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="partner-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Ad soyad" required error={errors.full_name?.message} className="sm:col-span-2">
          {(props) => <Input {...props} {...register("full_name")} />}
        </Field>
        <Field label="Telefon" error={errors.phone?.message}>
          {(props) => <Input {...props} {...register("phone")} type="tel" />}
        </Field>
        <Field label="E-posta" error={errors.email?.message}>
          {(props) => <Input {...props} {...register("email")} type="email" />}
        </Field>
        <Field
          label="Kuruş sırası"
          hint="Kâr 3'e tam bölünmediğinde artan kuruş küçük sıradaki ortağa yazılır."
          error={errors.sort_order?.message}
        >
          {(props) => <Input {...props} {...register("sort_order")} inputMode="numeric" />}
        </Field>
        {canLinkUser && (
          <Field label="Kullanıcı hesabı" hint="Ortağın sisteme giriş yaptığı hesap">
            {(props) => (
              <Select {...props} {...register("user_id")}>
                <option value="">Bağlı değil</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} · {user.email}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Not" className="sm:col-span-2">
          {(props) => <Textarea {...props} {...register("notes")} />}
        </Field>
        <Checkbox
          {...register("is_active")}
          label="Aktif ortak"
          description="Sadece aktif ortaklar kâr/zarar bölüşümüne katılır."
          className="sm:col-span-2"
        />
        {mutation.isError && (
          <p className="text-sm text-danger-600 sm:col-span-2">{errorMessage(mutation.error)}</p>
        )}
      </form>
    </Dialog>
  );
}
