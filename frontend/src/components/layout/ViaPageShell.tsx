import type { ReactNode } from "react";

type ViaPageShellProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function ViaPageShell({
  eyebrow,
  title,
  description,
  onBack,
  backLabel = "Geri Dön",
  actions,
  children,
}: ViaPageShellProps) {
  const hasHeader = eyebrow || title || description || onBack || actions;

  return (
    <main className="flex flex-1 flex-col">
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

        {hasHeader ? (
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">
                  {eyebrow}
                </p>
              ) : null}

              {title ? (
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  {title}
                </h1>
              ) : null}

              {description ? (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  {description}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
              </div>
            ) : null}
          </header>
        ) : null}

        <div className="min-w-0 flex-1">{children}</div>
      </section>
    </main>
  );
}