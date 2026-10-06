import { cn } from "@/shared/lib/cn";
import { formatMoney, type Currency } from "@/shared/lib/format";

interface MoneyProps {
  amount: string | number;
  currency?: Currency;
  /** Döviz işlemlerinde TL karşılığı. Verilirse altında küçük olarak gösterilir. */
  baseAmount?: string | number;
  /** Pozitif/negatif renklendirme (kâr/zarar gibi) */
  signed?: boolean;
  className?: string;
}

/**
 * Para gösteriminin TEK yolu. Orijinal tutar her zaman kendi para birimiyle,
 * TL karşılığı ise ayrıca ve açıkça gösterilir; ikisi asla karıştırılmaz.
 */
export function Money({ amount, currency = "TRY", baseAmount, signed, className }: MoneyProps) {
  const value = Number(amount);
  const tone = signed ? (value > 0 ? "text-success-700" : value < 0 ? "text-danger-700" : "") : "";
  const showBase = baseAmount !== undefined && currency !== "TRY";
  return (
    <span className={cn("inline-flex flex-col tabular", className)}>
      <span className={tone}>{formatMoney(amount, currency)}</span>
      {showBase && (
        <span className="text-xs text-ink-muted">≈ {formatMoney(baseAmount, "TRY")}</span>
      )}
    </span>
  );
}
