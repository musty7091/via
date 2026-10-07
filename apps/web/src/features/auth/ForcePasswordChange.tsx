import { useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router";

import { useLogout, type Me } from "@/features/auth/auth";
import { PasswordChangeFields } from "@/features/auth/PasswordChangeForm";
import { usePasswordChangeForm } from "@/features/auth/usePasswordChangeForm";
import { Button, Logo, toast } from "@/shared/ui";

/** Yöneticinin verdiği geçici şifreyle giren kullanıcı, kendi şifresini belirlemeden devam edemez. */
export function ForcePasswordChange({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = useLogout();
  const state = usePasswordChangeForm(() => {
    toast.success("Şifreniz kaydedildi. Hoş geldiniz!");
    // Şifre değişmeden önce reddedilen istekler yeniden yüklensin.
    void queryClient.invalidateQueries();
  });

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-8 text-brand-900">
          <Logo />
        </div>
        <div className="mb-6 flex gap-3">
          <KeyRound className="mt-1 size-5 shrink-0 text-brand-700" aria-hidden />
          <div>
            <h1 className="text-xl font-normal">Kendi şifrenizi belirleyin</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Merhaba {me.full_name}. Hesabınız yöneticinin verdiği geçici şifreyle açıldı. Devam etmeden önce
              yalnızca sizin bildiğiniz yeni bir şifre belirleyin.
            </p>
          </div>
        </div>
        <PasswordChangeFields formId="force-password" state={state} currentLabel="Geçici şifre" />
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/giris", { replace: true }) })}
          >
            Çıkış yap
          </Button>
          <Button type="submit" form="force-password" loading={state.mutation.isPending}>
            Şifremi Kaydet
          </Button>
        </div>
      </div>
    </main>
  );
}
