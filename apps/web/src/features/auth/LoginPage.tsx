import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";

import { useLogin, useMe } from "@/features/auth/auth";
import { errorMessage } from "@/shared/api/client";
import { Button, Field, Input, Logo } from "@/shared/ui";

const schema = z.object({
  email: z.email("Geçerli bir e-posta adresi girin."),
  password: z.string().min(1, "Şifrenizi girin."),
});

type FormValues = z.infer<typeof schema>;

const CURRENT_YEAR = new Date().getFullYear();

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const login = useLogin();
  const next = safeNext(params.get("next"));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (me.data) return <Navigate to={next} replace />;

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => navigate(next, { replace: true }) }),
  );

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(480px,40%)]">
      <aside className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo className="text-white" />
        <div className="relative z-10 max-w-md">
          <p lang="en" className="mb-4 text-xs tracking-[0.3em] text-accent-500 uppercase">
            Back Office
          </p>
          <h1 className="font-display text-4xl leading-tight font-light text-white">
            Etkinlikten kapanışa, her kuruş yerli yerinde.
          </h1>
          <p className="mt-4 text-brand-200">
            Teklif, etkinlik, tahsilat, ortak hesapları ve dönem kapanışı tek yerde.
          </p>
        </div>
        <p className="text-sm text-brand-300">© {CURRENT_YEAR} VIA EVENTS</p>
        <svg
          aria-hidden
          viewBox="0 0 520 360"
          className="pointer-events-none absolute -right-24 -bottom-16 w-[620px] text-white/[0.04]"
        >
          <path d="M48 66V318L262 80M165 282L378 80M268 282L510 40V316" stroke="currentColor" strokeWidth="22" fill="none" />
        </svg>
      </aside>

      <main className="flex flex-col justify-center bg-surface px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 text-brand-900 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-normal">Giriş yap</h2>
          <p className="mt-1 text-sm text-ink-muted">Hesap bilgilerinizle devam edin.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
            <Field label="E-posta" error={errors.email?.message}>
              {(props) => (
                <Input
                  {...props}
                  {...register("email")}
                  type="email"
                  autoComplete="username"
                  autoFocus
                  className="h-11"
                />
              )}
            </Field>
            <Field label="Şifre" error={errors.password?.message}>
              {(props) => (
                <Input
                  {...props}
                  {...register("password")}
                  type="password"
                  autoComplete="current-password"
                  className="h-11"
                />
              )}
            </Field>

            {login.isError && (
              <p role="alert" className="rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
                {errorMessage(login.error)}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
              <LogIn /> Giriş Yap
            </Button>
          </form>

          <p className="mt-8 text-xs text-ink-muted">
            Şifrenizi unuttuysanız yöneticinizden sıfırlamasını isteyin.
          </p>
        </div>
      </main>
    </div>
  );
}
