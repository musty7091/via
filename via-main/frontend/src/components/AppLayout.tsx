import type { ReactNode } from "react";

import { clearAuthSession, getStoredUser } from "../services/authStorage";

/**
 * AppLayout — VIA EVENTS'in TEK ortak ekran tabanı.
 *
 * Tüm korumalı sayfalar (Dashboard, Müşteriler, Teklifler, Finans vb.)
 * artık header / footer / orta konteyner alanını BURADAN alır.
 * Böylece her sayfa kendi başına ayrı bir düzen kurmaz; hepsi aynı tabandan beslenir.
 *
 * Geriye dönük uyumluluk:
 * - userName verilmezse oturumdaki kullanıcı adı otomatik gösterilir.
 * - onLogout verilmezse güvenli bir varsayılan çıkış işlemi çalışır.
 */
export type AppLayoutProps = {
  /** Header sağ üstte gösterilecek kullanıcı adı. Boşsa oturumdan okunur. */
  userName?: string;
  /** Çıkış butonuna basılınca çalışır. Boşsa güvenli varsayılan çıkış yapılır. */
  onLogout?: () => void;

  /** İçeriğin üstünde "← Geri Dön" butonu gösterir. */
  onBack?: () => void;
  backLabel?: string;

  /** Logonun yanında, header içinde küçük sayfa başlığı (eski MainLayout görünümü). */
  headerTitle?: string;

  /** İçeriğin üstünde zengin başlık kartı (eski ViaPageShell görünümü). */
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Başlık kartının sağ tarafındaki aksiyon butonları. */
  actions?: ReactNode;

  /** Orta konteyner genişliği. Varsayılan: max-w-7xl */
  maxWidthClassName?: string;

  children: ReactNode;
};

function defaultLogout() {
  clearAuthSession();

  window.history.replaceState(
    { screen: "landing" },
    "",
    `${window.location.pathname}${window.location.search}#landing`
  );

  window.location.reload();
}

export function AppLayout({
  userName,
  onLogout,
  onBack,
  backLabel = "Geri Dön",
  headerTitle,
  eyebrow,
  title,
  description,
  actions,
  maxWidthClassName = "max-w-7xl",
  children,
}: AppLayoutProps) {
  const storedUser = getStoredUser();
  const displayName = userName ?? storedUser?.full_name ?? "";

  const handleLogout = onLogout ?? defaultLogout;

  const hasTitleCard = Boolean(eyebrow || title || description || actions);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 font-sans">
      {/* ---- HEADER (tüm sayfalarda aynı) ---- */}
      <header className="sticky top-0 z-30 flex-none border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className={`mx-auto flex w-full ${maxWidthClassName} items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src="/brand/via-logo-horizontal.png"
              alt="VIA EVENTS"
              draggable={false}
              className="h-8 w-auto flex-none select-none object-contain sm:h-10"
            />

            {headerTitle ? (
              <>
                <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
                <h1 className="truncate text-base font-bold text-slate-900 sm:text-xl">
                  {headerTitle}
                </h1>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {displayName ? (
              <div className="hidden text-right sm:block">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Oturum
                </p>
                <p className="mt-0.5 max-w-[12rem] truncate text-sm font-bold text-slate-900">
                  {displayName}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 whitespace-nowrap"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* ---- İÇERİK (orta konteyner, tüm sayfalarda aynı) ---- */}
      <main className="flex-1">
        <div className={`mx-auto flex w-full ${maxWidthClassName} flex-col gap-5 px-4 py-6 sm:px-6`}>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 w-fit items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
            >
              ← {backLabel}
            </button>
          ) : null}

          {hasTitleCard ? (
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

                  {description ? (
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                      {description}
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
        </div>
      </main>

      {/* ---- FOOTER (tüm sayfalarda aynı) ---- */}
      <footer className="flex-none border-t border-slate-200 bg-white">
        <div className={`mx-auto w-full ${maxWidthClassName} px-4 py-5 text-center text-xs font-semibold text-slate-400 sm:px-6`}>
          © 2026 VIA EVENTS. Tüm hakları saklıdır.
        </div>
      </footer>
    </div>
  );
}

export default AppLayout;
