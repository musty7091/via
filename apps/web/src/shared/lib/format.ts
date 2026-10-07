/**
 * Tüm biçimlendirme tek yerden yapılır. Sayfalarda kendi formatMoney fonksiyonunuzu yazmayın.
 * API para tutarlarını metin olarak gönderir ("1234.50"); float hatası olmaması için
 * hesaplama backend'de yapılır, burada sadece gösterilir.
 */

export type Currency = "TRY" | "EUR" | "GBP" | "USD";

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "TRY", label: "TL (₺)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "Sterlin (£)" },
  { value: "USD", label: "Dolar ($)" },
];

export const TIME_ZONE = "Europe/Istanbul";

const moneyFormatters = new Map<Currency, Intl.NumberFormat>();

function moneyFormatter(currency: Currency) {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(currency, formatter);
  }
  return formatter;
}

export function formatMoney(amount: string | number, currency: Currency = "TRY") {
  return moneyFormatter(currency).format(Number(amount));
}

/** Tutarın işaretini çevirir (gider/maliyet satırlarında eksi göstermek için).
 * Metin olarak çalışır: "-500.00" → "500.00", "0.00" → "0.00" (eksi sıfır olmaz). */
export function negate(amount: string | number): string {
  const text = String(amount).trim();
  if (Number(text) === 0) return text.replace(/^-/, "");
  return text.startsWith("-") ? text.slice(1) : `-${text}`;
}

const numberFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 6 });

export function formatNumber(value: string | number) {
  return numberFormatter.format(Number(value));
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const monthFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** "2026-06-15" gibi tarihleri yerel saatte gece yarısı olarak okur (UTC kaymasını önler). */
function parseDate(value: string) {
  return value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
}

export function formatDate(value: string, variant: "long" | "short" = "long") {
  return (variant === "long" ? dateFormatter : shortDateFormatter).format(parseDate(value));
}

/** "2026-06" -> "Haziran 2026" */
export function formatPeriod(period: string) {
  return monthFormatter.format(parseDate(`${period}-15`));
}

/** Türkiye/KKTC saatine göre bugünün tarihi (YYYY-MM-DD). */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}
