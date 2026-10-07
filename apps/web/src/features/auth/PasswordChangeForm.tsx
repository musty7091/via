import { type usePasswordChangeForm } from "@/features/auth/usePasswordChangeForm";
import { errorMessage } from "@/shared/api/client";
import { Field, Input } from "@/shared/ui";

export function PasswordChangeFields({
  formId,
  state,
  currentLabel = "Mevcut şifre",
}: {
  formId: string;
  state: ReturnType<typeof usePasswordChangeForm>;
  currentLabel?: string;
}) {
  const {
    register,
    formState: { errors },
  } = state.form;
  return (
    <form id={formId} onSubmit={state.submit} className="space-y-4" noValidate>
      <Field label={currentLabel} error={errors.current_password?.message}>
        {(props) => (
          <Input {...props} {...register("current_password")} type="password" autoComplete="current-password" />
        )}
      </Field>
      <Field label="Yeni şifre" hint="En az 10 karakter" error={errors.new_password?.message}>
        {(props) => <Input {...props} {...register("new_password")} type="password" autoComplete="new-password" />}
      </Field>
      <Field label="Yeni şifre (tekrar)" error={errors.confirm?.message}>
        {(props) => <Input {...props} {...register("confirm")} type="password" autoComplete="new-password" />}
      </Field>
      {state.mutation.isError && <p className="text-sm text-danger-600">{errorMessage(state.mutation.error)}</p>}
    </form>
  );
}
