import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useChangePassword } from "@/features/auth/auth";
import { passwordSchema } from "@/shared/lib/validation";

const schema = z
  .object({
    current_password: z.string().min(1, "Mevcut şifrenizi girin."),
    new_password: passwordSchema,
    confirm: z.string(),
  })
  .refine((values) => values.new_password === values.confirm, {
    path: ["confirm"],
    message: "Şifreler eşleşmiyor.",
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ["new_password"],
    message: "Yeni şifre mevcut şifreden farklı olmalı.",
  });

type FormValues = z.infer<typeof schema>;

/** Şifre değiştirme formu. Gönder butonu formun dışında olabilir: `form={formId}`. */
export function usePasswordChangeForm(onDone: () => void) {
  const mutation = useChangePassword();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const submit = form.handleSubmit(({ current_password, new_password }) =>
    mutation.mutate({ current_password, new_password }, { onSuccess: onDone }),
  );
  const reset = () => {
    form.reset();
    mutation.reset();
  };
  return { form, mutation, submit, reset };
}
