export function formatMoney(value: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

export function compactText(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value.replace(/\n+/g, " • ");
}
