import { EyeOff, Package as PackageIcon, Pencil, Trash2 } from "lucide-react";

import type { OfferLine } from "@/features/offers/api";
import { formatNumber, type Currency } from "@/shared/lib/format";
import { Button, Money } from "@/shared/ui";

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : null);
const timeRange = (start: string | null, end: string | null) => (start ? `${hhmm(start)} – ${hhmm(end)}` : null);

/** Teklif ve etkinlikte program/fiyat satırı. Paket içeriği girintili ve "Dahil" gösterilir. */
export function LineRow({
  line,
  currency,
  nested,
  editable,
  onEdit,
  onDelete,
  hidePrices = false,
}: {
  line: OfferLine;
  currency: string;
  nested?: boolean;
  editable: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Fiyat görme yetkisi olmayanlar (operasyon) için */
  hidePrices?: boolean;
}) {
  const isComponent = line.line_type === "package_component";
  const time = timeRange(line.start_time, line.end_time);
  return (
    <li className={`flex items-start gap-3 py-3 pr-4 sm:pr-5 ${nested ? "pl-9 sm:pl-12" : "pl-4 sm:pl-5"}`}>
      <div className="min-w-0 flex-1">
        <p className={`flex flex-wrap items-center gap-2 text-sm ${nested ? "text-ink-soft" : "font-medium text-ink"}`}>
          {line.line_type === "package" && <PackageIcon className="size-4 text-brand-600" aria-hidden />}
          {line.title}
          {!line.is_visible && (
            <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-muted">
              <EyeOff className="size-3" aria-hidden /> Müşteri görmez
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {[time, Number(line.quantity) !== 1 ? `${formatNumber(line.quantity)} adet` : null, line.description]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {line.cost_total_base !== null && Number(line.cost_total_base) > 0 && (
          <p className="mt-0.5 text-xs text-ink-faint">
            Maliyet: <Money amount={line.cost_total_base} />
          </p>
        )}
      </div>
      {!hidePrices && (
      <div className="shrink-0 text-right text-sm">
        {isComponent ? (
          <span className="text-xs text-ink-muted">Dahil</span>
        ) : (
          <>
            <Money amount={line.line_total} currency={currency as Currency} className="font-medium" />
            {Number(line.quantity) !== 1 && (
              <p className="text-xs text-ink-muted">
                × <Money amount={line.unit_price} currency={currency as Currency} />
              </p>
            )}
          </>
        )}
      </div>
      )}
      {editable && (
        <div className="-mr-2 flex shrink-0 flex-col sm:mr-0 sm:flex-row">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`${line.title} düzenle`}>
            <Pencil />
          </Button>
          {onDelete && (
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`${line.title} sil`}>
              <Trash2 />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

