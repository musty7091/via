export const eventStatusOptions = [
  { value: "planned", label: "Planlandı" },
  { value: "preparation", label: "Hazırlıkta" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
  { value: "draft", label: "Taslak" },
];

export const invoiceTypeOptions = [
  { value: "without_invoice", label: "Faturasız" },
  { value: "with_invoice", label: "Faturalı" },
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
