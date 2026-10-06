import type { CustomerListItem } from "@/features/customers/api";
import { Badge } from "@/shared/ui";

export function RiskBadge({ level }: { level: CustomerListItem["risk_level"] }) {
  if (level === "blocked") return <Badge tone="danger">Engelli</Badge>;
  if (level === "watch") return <Badge tone="warning">Takipte</Badge>;
  return null;
}
