/** Sezon hesapları (backend'deki closing.periods.season_bounds ile aynı kural). */

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/** Ayın içinde bulunduğu sezonun ilk ve son ayı (sezon 12 ay). */
export function seasonBounds(month: string, startMonth: number) {
  const [y, m] = month.split("-").map(Number);
  const firstYear = m >= startMonth ? y : y - 1;
  const lastIndex = startMonth - 1 + 11;
  return { first: monthKey(firstYear, startMonth), last: monthKey(firstYear + Math.floor(lastIndex / 12), (lastIndex % 12) + 1) };
}

export function monthsBetween(first: string, last: string) {
  const [fy, fm] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  return (ly - fy) * 12 + (lm - fm) + 1;
}
