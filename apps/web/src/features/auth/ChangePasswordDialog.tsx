import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useChangePassword } from "@/features/auth/auth";
import { errorMessage } from "@/shared/api/client";
import { passwordSchema } from "@/shared/lib/validation";
import { Button, Dialog, Field, Input, toast } from "@/shared/ui";

const schema = z
  .object({
    current_password: z.string().min(1, "Mevcut şifrenizi girin."),
    new_password: passwordSchema,
    confirm: z.string(),
  })
  .refine((values) => values.new_password === values.confirm, {
    path: ["confirm"],
    message: "Şifreler eşleşmiyor.",
  });

type FormValues = z.infer<typeof schema>;

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mutation = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const close = (next: boolean) => {
    if (!next) {
      reset();
      mutation.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ current_password, new_password }) =>
    mutation.mutate(
      { current_password, new_password },
      {
        onSuccess: () => {
          toast.success("Şifreniz değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.");
          close(false);
        },
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Şifremi Değiştir"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="change-password" loading={mutation.isPending}>
            Şifreyi Değiştir
          </Button>
        </>
      }
    >
      <form id="change-password" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Mevcut şifre" error={errors.current_password?.message}>
          {(props) => (
            <Input {...props} {...register("current_password")} type="password" autoComplete="current-password" />
          )}
        </Field>
        <Field label="Yeni şifre" hint="En az 10 karakter" error={errors.new_password?.message}>
          {(props) => (
            <Input {...props} {...register("new_password")} type="password" autoComplete="new-password" />
          )}
        </Field>
        <Field label="Yeni şifre (tekrar)" error={errors.confirm?.message}>
          {(props) => <Input {...props} {...register("confirm")} type="password" autoComplete="new-password" />}
        </Field>
        {mutation.isError && <p className="text-sm text-danger-600">{errorMessage(mutation.error)}</p>}
      </form>
    </Dialog>
  );
}
