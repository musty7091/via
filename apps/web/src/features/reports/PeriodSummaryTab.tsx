import { usePeriods } from "@/features/closing/api";
import { PrintLink } from "@/features/print/PrintLink";
import { usePeriodSummary } from "@/features/reports/api";
import { PeriodSummaryView } from "@/features/reports/PeriodSummaryView";
import { formatDate, todayISO } from "@/shared/lib/format";
import { Badge, ErrorState, LoadingState, Select } from "@/shared/ui";

/** Varsayılan ay: geçen ay (kayıt varsa), yoksa bu ay. */
function defaultSummaryMonth(months: string[]) {
  const d = new Date(`${todayISO()}T12:00:00`);
  d.setDate(0);
  const previous = d.toISOString().slice(0, 7);
  return months.includes(previous) ? previous : (months[0] ?? todayISO().slice(0, 7));
}

export function PeriodSummaryTab({ month, onMonth }: { month?: string; onMonth: (month: string) => void }) {
  const periods = usePeriods();
  const months = (periods.data ?? []).map((p) => p.month);
  const selected = month && months.includes(month) ? month : periods.data ? defaultSummaryMonth(months) : undefined;
  const summary = usePeriodSummary(selected);

  if (periods.isPending || (summary.isPending && selected)) return <LoadingState />;
  if (periods.isError) return <ErrorState error={periods.error} />;
  if (summary.isError) return <ErrorState error={summary.error} />;
  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Ay" value={selected} onChange={(e) => onMonth(e.target.value)} className="w-48">
          {(periods.data ?? []).map((p) => (
            <option key={p.month} value={p.month}>
              {p.label}
            </option>
          ))}
        </Select>
        {s && (
          <>
            <Badge tone={s.status === "closed" ? "success" : "info"}>{s.status === "closed" ? "Kapalı dönem" : "Açık dönem"}</Badge>
            <span className="text-sm text-ink-muted">{formatDate(s.as_of)} itibarıyla</span>
            <span className="ml-auto">
              <PrintLink to={`/yazdir/donem-ozeti/${s.month}`} label="Özeti yazdır" />
            </span>
          </>
        )}
      </div>
      {s && <PeriodSummaryView summary={s} />}
    </div>
  );
}
