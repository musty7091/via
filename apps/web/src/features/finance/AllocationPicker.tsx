import { CalendarRange, CalendarCheck, CalendarClock } from "lucide-react";

import { monthsBetween, seasonBounds } from "@/features/finance/season";
import { useCompany } from "@/features/print/company";
import { cn } from "@/shared/lib/cn";
import { formatMoney, formatPeriod, type Currency } from "@/shared/lib/format";
import { parseMoneyInput } from "@/shared/lib/validation";

export type Allocation = "month" | "season" | "rest_of_season";

const OPTIONS: { value: Allocation; title: string; text: string; icon: typeof CalendarCheck }[] = [
  { value: "month", title: "Bu döneme ait", text: "Sadece gider ayının sonucuna yazılır.", icon: CalendarCheck },
  { value: "season", title: "Tüm sezona ait", text: "Sezonun 12 ayına eşit bölünür (ör. yıllık sigorta, lisans).", icon: CalendarRange },
  { value: "rest_of_season", title: "Bu aydan sezon sonuna", text: "Gider ayından sezon sonuna kadar eşit bölünür.", icon: CalendarClock },
];

interface Props {
  value: Allocation;
  onChange: (value: Allocation) => void;
  expenseDate: string | undefined;
  amount: string | undefined;
  currency: string | undefined;
}

/** Genel giderin hangi aylara ait olduğunu açıkça seçtirir ve sonucu önizler. */
export function AllocationPicker({ value, onChange, expenseDate, amount, currency }: Props) {
  const company = useCompany();
  const startMonth = company.data?.season_start_month ?? 1;
  const month = (expenseDate || "").slice(0, 7);
  const parsed = parseMoneyInput(amount ?? "");
  const total = parsed ? Number(parsed) : 0;

  let preview: string | null = null;
  if (month && value !== "month") {
    const { first, last } = seasonBounds(month, startMonth);
    const from = value === "season" ? first : month;
    const count = monthsBetween(from, last);
    const share = total / count;
    const past = value === "season" ? monthsBetween(first, month) - 1 : 0;
    const money = (v: number) => formatMoney(v, (currency || "TRY") as Currency);
    preview =
      `${formatPeriod(from)} – ${formatPeriod(last)} arası ${count} aya bölünür` +
      (total ? `: ayda ${money(share)}.` : ".") +
      (past > 0 && total
        ? ` Geçmiş ${past} ayın payı (${money(share * past)}) ${formatPeriod(month)} sonucuna eklenir; geriye dönük kayıt yapılmaz.`
        : "");
  }

  return (
    <fieldset className="sm:col-span-2">
      <legend className="mb-1.5 text-sm font-medium text-ink">Bu gider hangi döneme ait?</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
        {OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                active ? "border-brand-700 bg-brand-50 ring-1 ring-brand-700" : "border-line-strong hover:border-brand-300",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <o.icon className={cn("size-4", active ? "text-brand-700" : "text-ink-muted")} aria-hidden /> {o.title}
              </span>
              <span className="text-xs text-ink-muted">{o.text}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        {preview ?? "Dönem kapanışında ortaklara eşit yansıtılır."}{" "}
        <span className="text-ink-muted">
          Sezon: {formatPeriod(seasonBounds(month || "2026-01", startMonth).first).split(" ")[0]} başlangıçlı 12 ay (Ayarlar'dan değişir).
        </span>
      </p>
    </fieldset>
  );
}
