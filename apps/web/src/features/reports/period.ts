import type { DateRange } from "@/features/reports/api";
import { todayISO } from "@/shared/lib/format";

// --- Dönem ---

export type PeriodKey = "last12" | `${number}`;

export function periodRange(period: PeriodKey): DateRange & { first: string; last: string } {
  const today = todayISO();
  if (period === "last12") {
    const [y, m] = today.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 12, 1));
    const end = new Date(Date.UTC(y, m, 0));
    const first = start.toISOString().slice(0, 7);
    return { date_from: `${first}-01`, date_to: end.toISOString().slice(0, 10), first, last: today.slice(0, 7) };
  }
  return { date_from: `${period}-01-01`, date_to: `${period}-12-31`, first: `${period}-01`, last: `${period}-12` };
}

export function periodOptions() {
  const year = Number(todayISO().slice(0, 4));
  return [
    ...[year, year - 1, year - 2].map((y) => ({ value: String(y), label: String(y) })),
    { value: "last12", label: "Son 12 ay" },
  ];
}

/** Adres çubuğundaki "donem" değerini geçerli bir döneme çevirir (yoksa bu yıl). */
export function parsePeriod(value: string | null): PeriodKey {
  const options = periodOptions();
  return (options.find((o) => o.value === value)?.value ?? options[0].value) as PeriodKey;
}

export function periodLabel(period: PeriodKey) {
  return period === "last12" ? "Son 12 ay" : period;
}
