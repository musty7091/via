import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useResetPassword, type User } from "@/features/users/api";
import { errorMessage } from "@/shared/api/client";
import { passwordSchema } from "@/shared/lib/validation";
import { Button, Dialog, Field, Input, toast } from "@/shared/ui";

const schema = z.object({ new_password: passwordSchema });

export function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const mutation = useResetPassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const close = () => {
    reset();
    mutation.reset();
    onClose();
  };

  const onSubmit = handleSubmit(({ new_password }) => {
    if (!user) return;
    mutation.mutate(
      { id: user.id, new_password },
      {
        onSuccess: () => {
          toast.success(`${user.full_name} için yeni şifre belirlendi.`);
          close();
        },
      },
    );
  });

  return (
    <Dialog
      open={user !== null}
      onOpenChange={(open) => !open && close()}
      title="Şifre Sıfırla"
      description={user ? `${user.full_name} · ${user.email}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Vazgeç
          </Button>
          <Button type="submit" form="reset-password" loading={mutation.isPending}>
            Şifreyi Sıfırla
          </Button>
        </>
      }
    >
      <form id="reset-password" onSubmit={onSubmit} className="space-y-4" noValidate>
        <p className="rounded-md bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
          Kullanıcının tüm açık oturumları kapanır. Yeni şifreyi kendisine güvenli bir yoldan iletin.
        </p>
        <Field label="Yeni şifre" hint="En az 10 karakter" error={errors.new_password?.message}>
          {(props) => <Input {...props} {...register("new_password")} type="text" autoComplete="new-password" />}
        </Field>
        {mutation.isError && <p className="text-sm text-danger-600">{errorMessage(mutation.error)}</p>}
      </form>
    </Dialog>
  );
}
