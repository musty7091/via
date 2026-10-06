import { useParams } from "react-router";

import { PrintLayout } from "@/features/print/PrintLayout";
import { usePeriodSummary } from "@/features/reports/api";
import { PeriodSummaryView } from "@/features/reports/PeriodSummaryView";
import { formatDate } from "@/shared/lib/format";

export function PeriodSummaryPrintPage() {
  const month = useParams().month;
  const summary = usePeriodSummary(month);
  const s = summary.data;
  return (
    <PrintLayout
      kind="DÖNEM ÖZETİ"
      title={s?.label ?? ""}
      meta={s ? [["Durum", s.status === "closed" ? "Kapalı" : "Açık"], ["İtibarıyla", formatDate(s.as_of, "short")]] : []}
      loading={summary.isPending}
      error={summary.error}
    >
      {s && <PeriodSummaryView summary={s} print />}
    </PrintLayout>
  );
}
