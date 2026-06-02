export const currencyOptions = [
  { value: "TRY", label: "TRY" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "USD", label: "USD" },
] as const;

export const artistTypeOptions = [
  { value: "solo_artist", label: "Solo sanatçı" },
  { value: "group", label: "Grup" },
  { value: "dj", label: "DJ" },
  { value: "dancer", label: "Dansçı" },
  { value: "musician", label: "Müzisyen / eşlikçi" },
  { value: "performance_team", label: "Performans ekibi" },
  { value: "other", label: "Diğer" },
];

export const serviceTypeOptions = [
  { value: "sound_system", label: "Ses sistemi" },
  { value: "lighting_system", label: "Işık sistemi" },
  { value: "stage", label: "Sahne" },
  { value: "operation_staff", label: "Operasyon personeli" },
  { value: "transportation", label: "Ulaşım" },
  { value: "accommodation", label: "Konaklama" },
  { value: "technical_service", label: "Teknik hizmet" },
  { value: "other", label: "Diğer" },
];

export const packageTypeOptions = [
  { value: "program", label: "Program akışı" },
  { value: "combination", label: "Kombinasyon" },
  { value: "technical_bundle", label: "Teknik paket" },
  { value: "custom", label: "Özel paket" },
];

export const componentTypeOptions = [
  { value: "artist", label: "Sanatçı hizmeti" },
  { value: "service", label: "Teknik / operasyon hizmeti" },
  { value: "manual", label: "Manuel kalem" },
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
