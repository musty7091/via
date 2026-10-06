import type { EventListItem } from "@/features/events/api";
import { EventStatusBadge } from "@/features/offers/OfferStatusBadge";
import { formatDate } from "@/shared/lib/format";
import { Money, type Column } from "@/shared/ui";

export function eventColumns(showMoney: boolean): Column<EventListItem>[] {
  return [
    {
      key: "title",
      header: "Etkinlik",
      cell: (e) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{e.title}</p>
          <p className="text-xs text-ink-muted">
            {e.event_no} · {e.customer.name}
          </p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Tarih",
      cell: (e) => (
        <span>
          {formatDate(e.event_date)}
          {e.start_time && <span className="text-ink-muted"> · {e.start_time.slice(0, 5)}</span>}
        </span>
      ),
    },
    { key: "venue", header: "Mekân", hideOnMobile: true, cell: (e) => e.venue?.name ?? <span className="text-ink-faint">—</span> },
    { key: "status", header: "Durum", cell: (e) => <EventStatusBadge status={e.status} /> },
    ...(showMoney
      ? [
          {
            key: "total",
            header: "Anlaşma",
            align: "right" as const,
            cell: (e: EventListItem) => <Money amount={e.total_amount} currency={e.currency} baseAmount={e.base_total_amount} />,
          },
        ]
      : []),
  ];
}
