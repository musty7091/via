import { useEffect } from "react";

import { useCan } from "@/features/auth/auth";
import type { EventDetail } from "@/features/events/api";
import { useCashAccounts, useEventFinance } from "@/features/finance/api";
import { useSuggestedRate } from "@/features/rates/useSuggestedRate";
import { decimalText, type RefundState } from "@/features/events/refund";
import { formatMoney, todayISO, type Currency } from "@/shared/lib/format";
import { Checkbox, Field, Input, Select } from "@/shared/ui";

/**
 * İptal edilen etkinlikte alınmış paranın akıbeti. Kural: kapora geri verilmez (şirkette kalır,
 * etkinlik geliri olur); istisnai durumda bir kısmı veya tamamı müşteriye iade edilir.
 */
export function CancelSettlement({
  event,
  refund,
  onChange,
}: {
  event: EventDetail;
  refund: RefundState;
  onChange: (next: RefundState) => void;
}) {
  const can = useCan();
  const canRefund = can("finance.record");
  const finance = useEventFinance(can("finance.view") ? event.id : 0);
  const accounts = useCashAccounts(refund.enabled);
  const currency = event.currency as Currency;
  const foreign = currency !== "TRY";
  const suggestedRate = useSuggestedRate({
    currency,
    day: refund.date,
    current: refund.rate,
    apply: (value) => onChange({ ...refund, rate: value }),
    enabled: refund.enabled && foreign,
  });

  const f = finance.data;
  const collected = Number(f?.collected_amount ?? 0);
  const hasPaidCosts = (f?.payables ?? []).some((p) => p.status === "active" && Number(p.paid_amount) > 0);

  // İade açılınca varsayılan tutar alınan paranın tamamıdır.
  useEffect(() => {
    if (refund.enabled && !refund.amount && collected > 0) {
      onChange({ ...refund, amount: String(collected).replace(".", ",") });
    }
  }, [refund, collected, onChange]);

  if (!f) return null;
  const refundAmount = refund.enabled ? Math.min(Number(decimalText(refund.amount)) || 0, collected) : 0;
  const kept = Math.max(collected - refundAmount, 0);
  const options = (accounts.data ?? []).filter((a) => a.is_active && a.currency === currency);

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface-muted px-4 py-3 text-sm">
      {collected > 0 ? (
        <>
          <p>
            Müşteriden alınan: <strong className="font-semibold">{formatMoney(collected, currency)}</strong>. Kapora
            geri verilmez; bu tutar şirkette kalır ve etkinlik geliri olarak yazılır.
          </p>
          {canRefund && (
            <Checkbox
              label="İstisna: müşteriye iade yapılacak"
              description="Tamamı veya bir kısmı kasadan/bankadan geri ödenir."
              checked={refund.enabled}
              onChange={(e) => onChange({ ...refund, enabled: e.target.checked })}
            />
          )}
          {refund.enabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={`İade tutarı (${currency})`} required>
                {(p) => (
                  <Input
                    {...p}
                    inputMode="decimal"
                    value={refund.amount}
                    onChange={(e) => onChange({ ...refund, amount: e.target.value })}
                  />
                )}
              </Field>
              <Field label="İade tarihi" required>
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    max={todayISO()}
                    value={refund.date}
                    onChange={(e) => onChange({ ...refund, date: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Ödenen hesap" required className="sm:col-span-2">
                {(p) => (
                  <Select {...p} value={refund.accountId} onChange={(e) => onChange({ ...refund, accountId: e.target.value })}>
                    <option value="">Seçin</option>
                    {options.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · bakiye {formatMoney(a.balance, a.currency as Currency)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              {foreign && (
                <Field label={`Günün kuru (1 ${currency} = ? TL)`} required hint={suggestedRate.hint} className="sm:col-span-2">
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="decimal"
                      value={refund.rate}
                      onChange={(e) => onChange({ ...refund, rate: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </div>
          )}
          <p className="text-ink-soft">
            Şirkette kalacak: <strong className="font-semibold text-ink">{formatMoney(kept, currency)}</strong>
            {refundAmount > 0 && <> · İade: {formatMoney(refundAmount, currency)}</>}
          </p>
        </>
      ) : (
        <p>Bu etkinlikten henüz para alınmadı.</p>
      )}
      <p className="text-ink-muted">
        {hasPaidCosts
          ? "Sanatçı/tedarikçiye yapılmış ödemeler maliyet olarak kalır; ödenmemiş kısımlar iptal edilir."
          : "Sanatçı ve tedarikçi borçları iptal edilir."}{" "}
        Sonuç (kâr/zarar) iptal edildiği ayın sonucuna yazılır.
      </p>
    </div>
  );
}
