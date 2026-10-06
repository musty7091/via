import { CalendarDays, CircleAlert, ClipboardCheck, MapPin } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useBoard, type BoardItem } from "@/features/operations/api";
import { MyTasksCard } from "@/features/operations/MyTasksCard";
import { cn } from "@/shared/lib/cn";
import { formatDate, todayISO } from "@/shared/lib/format";
import { EVENT_STATUS } from "@/shared/lib/labels";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, Select } from "@/shared/ui";

const RANGES = [
  { days: 7, label: "Önümüzdeki 7 gün" },
  { days: 30, label: "Önümüzdeki 30 gün" },
  { days: 90, label: "Önümüzdeki 90 gün" },
];

function daysLabel(date: string, today: string) {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Yarın";
  if (diff < 0) return `${-diff} gün önce`;
  return `${diff} gün kaldı`;
}

function BoardCard({ item, today }: { item: BoardItem; today: string }) {
  const p = item.progress;
  const past = item.event_date < today;
  const reportMissing = past && p.report !== "submitted";
  return (
    <Link
      to={`/etkinlikler/${item.event_id}?sekme=operasyon`}
      className="block rounded-lg focus-visible:ring-3 focus-visible:ring-brand-200 focus-visible:outline-none"
    >
      <Card className="h-full transition-shadow hover:shadow-pop">
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted">{item.event_no}</p>
              <h2 className="truncate font-display text-lg text-ink">{item.title}</h2>
              <p className="truncate text-sm text-ink-muted">{item.customer}</p>
            </div>
            <Badge tone={EVENT_STATUS[item.status].tone}>{EVENT_STATUS[item.status].label}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-ink-muted" aria-hidden />
              {formatDate(item.event_date, "short")}
              {item.start_time ? ` ${item.start_time.slice(0, 5)}` : ""}
              <span className={cn("font-medium", item.event_date === today ? "text-brand-700" : "text-ink-muted")}>
                · {daysLabel(item.event_date, today)}
              </span>
            </span>
            {item.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-muted" aria-hidden /> {item.venue}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Görevler</span>
                <span>
                  {p.tasks_done} / {p.tasks_total}
                </span>
              </div>
              <ProgressBar value={p.tasks_done} max={p.tasks_total} label={`${item.title} görevleri`} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-muted">
                <span>Rider</span>
                <span>
                  {p.riders_ok} / {p.riders_total}
                </span>
              </div>
              <ProgressBar
                value={p.riders_ok}
                max={p.riders_total}
                label={`${item.title} rider kontrolü`}
                tone={p.rider_problems > 0 ? "danger" : undefined}
              />
            </div>
          </div>
          {(p.rider_problems > 0 || reportMissing) && (
            <ul className="space-y-1 text-xs font-medium">
              {p.rider_problems > 0 && (
                <li className="flex items-center gap-1.5 text-danger-700">
                  <CircleAlert className="size-3.5" aria-hidden /> {p.rider_problems} rider şartında sorun var
                </li>
              )}
              {reportMissing && (
                <li className="flex items-center gap-1.5 text-warning-700">
                  <CircleAlert className="size-3.5" aria-hidden /> Operasyon raporu bekleniyor
                </li>
              )}
            </ul>
          )}
        </div>
      </Card>
    </Link>
  );
}

export function OperationsBoardPage() {
  const [days, setDays] = useState(30);
  const board = useBoard(days);
  const today = todayISO();

  return (
    <>
      <PageHeader
        eyebrow="Operasyon"
        title="Operasyon Panosu"
        description="Yaklaşan etkinliklerin hazırlık durumu. Son 7 günün etkinlikleri rapor için listede kalır."
        actions={
          <Select aria-label="Dönem" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-52">
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </Select>
        }
      />
      {board.isPending ? (
        <LoadingState />
      ) : board.isError ? (
        <ErrorState error={board.error} />
      ) : board.data.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardCheck} title="Bu aralıkta etkinlik yok" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.data.map((item) => (
            <BoardCard key={item.event_id} item={item} today={today} />
          ))}
        </div>
      )}
      <MyTasksCard className="mt-6" />
    </>
  );
}
