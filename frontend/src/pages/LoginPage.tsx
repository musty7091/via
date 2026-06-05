import { FormEvent, useState } from "react";

import { loginUser } from "../services/apiClient";
import { saveAuthSession } from "../services/authStorage";
import type { AuthUser } from "../types/auth";

type LoginPageProps = {
  onLoginSuccess: (user: AuthUser) => void;
  onBack: () => void;
};

export function LoginPage({ onLoginSuccess, onBack }: LoginPageProps) {
  const [email, setEmail] = useState("admin@viaevents.com");
  const [password, setPassword] = useState("Via12345!");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      const result = await loginUser({ email, password });
      saveAuthSession(result.access_token, result.user);
      onLoginSuccess(result.user);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Giriş yapılırken bilinmeyen bir hata oluştu."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col justify-center">
        <button
          onClick={onBack}
          className="mb-6 w-fit rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200"
        >
          ← Ana ekrana dön
        </button>

        <section className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="rounded-[1.5rem] bg-white p-5 text-slate-950">
            <img src="/brand/via-logo-horizontal.png" alt="VIA EVENTS" className="h-12 w-auto object-contain" />
            <h1 className="mt-3 text-3xl font-black">Back Office Girişi</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Etkinlik, tahsilat, gider, operasyon ve ortak hesapları için
              güvenli yönetim alanı.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  E-posta
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium outline-none ring-teal-500 transition focus:ring-4"
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Şifre</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-medium outline-none ring-teal-500 transition focus:ring-4"
                  autoComplete="current-password"
                  required
                />
              </label>

              {errorMessage ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>
            </form>

            <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
              <p className="font-bold text-slate-800">Local test hesabı</p>
              <p className="mt-1">admin@viaevents.com / Via12345!</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}