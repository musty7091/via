import type { MonthRow } from "@/features/reports/api";
import { cn } from "@/shared/lib/cn";
import { formatMoney } from "@/shared/lib/format";

const short = (label: string) => label.split(" ")[0].slice(0, 3);

/**
 * Aylık gelir ve net sonuç çubukları. Kütüphanesiz; negatif sonuç sıfır çizgisinin altına iner.
 * Ekran okuyucu için her ay tek cümleyle özetlenir.
 */
export function MonthlyChart({ rows, className }: { rows: MonthRow[]; className?: string }) {
  const positive = Math.max(1, ...rows.flatMap((r) => [Number(r.revenue), Number(r.net)]));
  const negative = Math.max(0, ...rows.map((r) => -Number(r.net)));
  const total = positive + negative;
  const zero = (positive / total) * 100;
  const height = (value: number) => `${(Math.abs(value) / total) * 100}%`;

  return (
    <figure className={cn("space-y-3", className)}>
      <div className="flex items-center gap-4 text-xs text-ink-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-brand-700" /> Gelir
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success-600" /> Net sonuç
        </span>
      </div>
      <ul className="relative flex h-44 items-stretch gap-1 sm:gap-2">
        <li aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-line-strong" style={{ top: `${zero}%` }} />
        {rows.map((row) => {
          const revenue = Number(row.revenue);
          const net = Number(row.net);
          return (
            <li
              key={row.month}
              className="relative flex flex-1 justify-center gap-0.5 sm:gap-1"
              aria-label={`${row.label}: gelir ${formatMoney(revenue)}, net sonuç ${formatMoney(net)}`}
            >
              <div className="relative w-full max-w-5">
                <div className="absolute inset-x-0 rounded-t-sm bg-brand-700" style={{ bottom: `${100 - zero}%`, height: height(revenue) }} title={formatMoney(revenue)} />
              </div>
              <div className="relative w-full max-w-5">
                {net >= 0 ? (
                  <div className="absolute inset-x-0 rounded-t-sm bg-success-600" style={{ bottom: `${100 - zero}%`, height: height(net) }} title={formatMoney(net)} />
                ) : (
                  <div className="absolute inset-x-0 rounded-b-sm bg-danger-600" style={{ top: `${zero}%`, height: height(net) }} title={formatMoney(net)} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-1 sm:gap-2" aria-hidden>
        {rows.map((row) => (
          <span key={row.month} className="flex-1 text-center text-[11px] text-ink-muted">
            {short(row.label)}
          </span>
        ))}
      </div>
    </figure>
  );
}
