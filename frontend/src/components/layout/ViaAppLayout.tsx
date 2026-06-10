import type { ReactNode } from "react";

import type { AuthUser } from "../../types/auth";

type ViaAppLayoutProps = {
  user?: AuthUser | null;
  onLogout?: () => void;
  children: ReactNode;
};

export function ViaAppLayout({ user, onLogout, children }: ViaAppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex min-w-0 items-center">
            <img
              src="/brand/via-logo-horizontal.png"
              alt="VIA EVENTS"
              draggable={false}
              className="h-10 w-auto select-none object-contain"
            />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {user ? (
              <div className="flex h-11 min-w-[96px] flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-right shadow-sm">
                <span className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-slate-400">
                  Oturum
                </span>
                <span className="mt-1 max-w-[160px] truncate text-sm font-black leading-none text-slate-950">
                  {user.full_name}
                </span>
              </div>
            ) : null}

            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="h-11 rounded-full bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
              >
                Çıkış
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="mt-auto border-t border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-7xl px-5 py-5 text-center text-xs font-semibold text-slate-400">
          © 2026 VIA EVENTS. Tüm hakları saklıdır.
        </div>
      </footer>
    </div>
  );
}