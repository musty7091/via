import { useEffect, useRef } from "react";

import { useRates } from "@/features/rates/api";
import { formatDate } from "@/shared/lib/format";

const SOURCE = { tcmb: "TCMB satış", manual: "elle girilen" } as const;

interface Options {
  currency: string | undefined;
  /** Kaydın tarihi (YYYY-AA-GG); o gün veya öncesindeki en yeni kur önerilir. */
  day: string | undefined;
  /** Alanın şu anki değeri; boşsa öneri yazılır, kullanıcının yazdığına dokunulmaz. */
  current: string | undefined;
  apply: (value: string) => void;
  enabled?: boolean;
}

/**
 * Dövizli formlarda kur alanını günün kuruyla doldurur ve kaynağını ipucu olarak döner.
 * Kayıt kendi kurunu saklar; öneri sadece yazma kolaylığıdır.
 */
export function useSuggestedRate({ currency, day, current, apply, enabled = true }: Options) {
  const foreign = Boolean(currency && currency !== "TRY");
  const rates = useRates(day, enabled && foreign);
  // Kapalıyken önbellekteki kur da önerilmez; yoksa gizli bir alana değer yazılıp gönderilir.
  const rate = foreign && enabled ? rates.data?.find((r) => r.currency === currency) : undefined;
  const suggestion = rate ? String(Number(rate.rate)).replace(".", ",") : undefined;

  // Öneri, döviz veya tarih değiştiğinde çalışır:
  // - alan boşsa ya da son öneriyi taşıyorsa yeni öneri yazılır,
  // - döviz değiştiyse (eski dövizin kuru yanlış olur) yeni öneri yazılır,
  // - elle yazılmış kur sadece tarih değişince korunur; açılıştaki kayıtlı kura dokunulmaz.
  const latest = useRef({ current, apply });
  const last = useRef<{ currency?: string; value?: string }>({});
  useEffect(() => {
    latest.current = { current, apply };
  });
  useEffect(() => {
    if (!suggestion) return;
    const value = latest.current.current;
    const firstSeen = last.current.currency === undefined;
    const currencyChanged = !firstSeen && last.current.currency !== currency;
    if (!value || value === last.current.value || currencyChanged) {
      latest.current.apply(suggestion);
      last.current = { currency, value: suggestion };
    } else {
      last.current = { currency, value: last.current.value };
    }
  }, [suggestion, currency]);

  const hint = rate ? `${SOURCE[rate.source]} · ${formatDate(rate.day, "short")}: ${suggestion} TL` : undefined;
  return { suggestion, hint };
}
