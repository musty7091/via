import type { OfferListItem } from "@/features/offers/api";
import { OfferStatusBadge } from "@/features/offers/OfferStatusBadge";
import { formatDate } from "@/shared/lib/format";
import { Money, type Column } from "@/shared/ui";

export const offerColumns: Column<OfferListItem>[] = [
  {
    key: "title",
    header: "Teklif",
    cell: (o) => (
      <div className="min-w-0">
        <p className="font-medium text-ink">{o.title}</p>
        <p className="text-xs text-ink-muted">
          {o.offer_no} · {o.customer.name}
        </p>
      </div>
    ),
  },
  { key: "status", header: "Durum", cell: (o) => <OfferStatusBadge status={o.status} expired={o.is_expired} /> },
  {
    key: "event_date",
    header: "Etkinlik tarihi",
    cell: (o) => (o.event_date ? formatDate(o.event_date) : <span className="text-ink-faint">Belirsiz</span>),
  },
  { key: "partner", header: "Ortak", hideOnMobile: true, cell: (o) => o.partner.name },
  { key: "total", header: "Toplam", align: "right", cell: (o) => <Money amount={o.total_amount} currency={o.currency} /> },
];
