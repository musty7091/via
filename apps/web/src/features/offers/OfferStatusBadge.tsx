import { EVENT_STATUS, OFFER_STATUS } from "@/shared/lib/labels";
import { Badge } from "@/shared/ui";

export function OfferStatusBadge({ status, expired }: { status: string; expired?: boolean }) {
  const s = OFFER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge tone={s.tone}>{s.label}</Badge>
      {expired && <Badge tone="warning">Süresi doldu</Badge>}
    </span>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const s = EVENT_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
