export function formatMoney(value: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 5);
}
