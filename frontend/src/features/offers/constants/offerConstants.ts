export const currencyOptions = [
  { value: "TRY", label: "TRY" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "USD", label: "USD" },
] as const;

export const invoiceTypeOptions = [
  { value: "without_invoice", label: "Faturasız" },
  { value: "with_invoice", label: "Faturalı" },
];

export const offerStatusOptions = [
  { value: "draft", label: "Taslak" },
  { value: "sent", label: "Gönderildi" },
  { value: "accepted", label: "Kabul edildi" },
  { value: "agreement", label: "Anlaşma" },
  { value: "rejected", label: "Reddedildi" },
  { value: "cancelled", label: "İptal" },
];

export const programSectionOptions = [
  { value: "opening", label: "Açılış" },
  { value: "warmup", label: "Ön program" },
  { value: "main_performance", label: "Ana performans" },
  { value: "support_performance", label: "Destek performans" },
  { value: "closing", label: "Kapanış" },
  { value: "technical", label: "Teknik" },
  { value: "operation", label: "Operasyon" },
  { value: "other", label: "Diğer" },
];

export function getOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  return options.find((option) => option.value === value)?.label ?? value;
}
