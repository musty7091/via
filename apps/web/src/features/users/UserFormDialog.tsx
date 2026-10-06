import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useCreateUser, useRoles, useUpdateUser, type Role, type User } from "@/features/users/api";
import { errorMessage } from "@/shared/api/client";
import { passwordSchema } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, Input, Select, toast } from "@/shared/ui";

const ROLE_HINTS: Record<Role, string> = {
  super_admin: "Sistemin sahibi: her şey, finans onayı, dönem kapatma, ortak ve kullanıcı yönetimi.",
  partner: "Her şeyi görür; müşteri, teklif, etkinlik ve katalog yönetir. Finans kaydı ve onay yapamaz.",
  accounting: "Tahsilat, gider ve ödeme kaydı girer; onay veremez.",
  operation: "Etkinlik operasyonunu yürütür; maliyet ve finans görmez.",
  viewer: "Sadece görüntüler ve rapor alır.",
};

const baseSchema = z.object({
  full_name: z.string().trim().min(2, "Ad soyad en az 2 karakter olmalıdır."),
  email: z.email("Geçerli bir e-posta adresi girin."),
  role: z.enum(["super_admin", "partner", "accounting", "operation", "viewer"]),
  is_active: z.boolean(),
});
/** Şifre sadece yeni kullanıcıda zorunludur; düzenlemede ayrı "şifre sıfırla" işlemi var. */
const buildSchema = (isEdit: boolean) =>
  baseSchema.extend({ password: isEdit ? z.string() : passwordSchema });

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Verilirse düzenleme, verilmezse yeni kayıt */
  user?: User | null;
}

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const isEdit = Boolean(user);
  const roles = useRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = isEdit ? update : create;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(isEdit)),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? { full_name: user.full_name, email: user.email, role: user.role, is_active: user.is_active, password: "" }
        : { full_name: "", email: "", role: "viewer", is_active: true, password: "" },
    );
  }, [open, user, reset]);

  const close = (next: boolean) => {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  };

  const selectedRole = useWatch({ control, name: "role" });

  const onSubmit = handleSubmit(({ password, ...values }) => {
    const done = {
      onSuccess: () => {
        toast.success(isEdit ? "Kullanıcı güncellendi." : "Kullanıcı oluşturuldu.");
        close(false);
      },
    };
    if (user) update.mutate({ id: user.id, body: values }, done);
    else create.mutate({ ...values, password }, done);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={isEdit ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}
      description={isEdit ? user?.email : "Kullanıcı ilk girişte bu şifreyi kullanır."}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="user-form" loading={mutation.isPending}>
            {isEdit ? "Kaydet" : "Kullanıcıyı Oluştur"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Ad soyad" required error={errors.full_name?.message}>
          {(props) => <Input {...props} {...register("full_name")} autoComplete="off" />}
        </Field>
        <Field label="E-posta" required error={errors.email?.message}>
          {(props) => <Input {...props} {...register("email")} type="email" autoComplete="off" />}
        </Field>
        <Field
          label="Rol"
          required
          hint={selectedRole ? ROLE_HINTS[selectedRole] : undefined}
          className="sm:col-span-2"
        >
          {(props) => (
            <Select {...props} {...register("role")}>
              {roles.data?.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {!isEdit && (
          <Field
            label="Geçici şifre"
            required
            hint="En az 10 karakter. Kullanıcı girişten sonra değiştirebilir."
            error={errors.password?.message}
            className="sm:col-span-2"
          >
            {(props) => <Input {...props} {...register("password")} type="text" autoComplete="new-password" />}
          </Field>
        )}
        <Checkbox
          {...register("is_active")}
          label="Aktif"
          description="Pasif kullanıcılar giriş yapamaz; açık oturumları hemen kapanır."
          className="sm:col-span-2"
        />
        {mutation.isError && (
          <p className="text-sm text-danger-600 sm:col-span-2">{errorMessage(mutation.error)}</p>
        )}
      </form>
    </Dialog>
  );
}
