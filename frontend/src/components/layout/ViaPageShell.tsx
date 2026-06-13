import type { ReactNode } from "react";

import { clearAuthSession, getStoredUser } from "../../services/authStorage";

type ViaPageShellProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function ViaPageShell({
  eyebrow,
  title,
  description,
  subtitle,
  onBack,
  backLabel = "Geri Dön",
  actions,
  children,
}: ViaPageShellProps) {
  const user = getStoredUser();
  const finalDescription = description ?? subtitle ?? "";
  const hasTitleBlock = Boolean(eyebrow || title || finalDescription || actions);

  function handleLogout() {
    clearAuthSession();

    window.history.replaceState(
      { screen: "landing" },
      "",
      `${window.location.pathname}${window.location.search}#landing`
    );

    window.location.reload();
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center">
            <img
              src="/brand/via-logo-horizontal.png"
              alt="VIA EVENTS"
              draggable={false}
              className="h-9 w-auto select-none object-contain sm:h-10"
            />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {user ? (
              <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right sm:block">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Oturum
                </p>
                <p className="mt-0.5 max-w-[12rem] truncate text-sm font-black text-slate-950">
                  {user.full_name}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-5 py-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-fit items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            ← {backLabel}
          </button>
        ) : null}

        {hasTitleBlock ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                {eyebrow ? (
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">
                    {eyebrow}
                  </p>
                ) : null}

                {title ? (
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {title}
                  </h1>
                ) : null}

                {finalDescription ? (
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                    {finalDescription}
                  </p>
                ) : null}
              </div>

              {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {actions}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="min-w-0 flex-1">{children}</div>
      </section>

      <footer className="mx-auto w-full max-w-7xl border-t border-slate-200 px-5 py-5 text-center text-xs font-semibold text-slate-400">
        © 2026 VIA EVENTS. Tüm hakları saklıdır.
      </footer>
    </main>
  );
}