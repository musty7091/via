import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
};

export function PageShell({ eyebrow, title, subtitle, badge, children }: PageShellProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-2 truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
          </div>

          {badge ? (
            <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              {badge}
            </span>
          ) : null}
        </div>
      </section>

      {children}
    </div>
  );
}
