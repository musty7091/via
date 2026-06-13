export const currencyOptions = [
  { value: "TRY", label: "TL" },
  { value: "EUR", label: "EUR" },
  { value: "USD", label: "USD" },
  { value: "GBP", label: "GBP" },
] as const;

export const artistTypeOptions = [
  { value: "solo_artist", label: "Solo sanatçı" },
  { value: "group", label: "Grup" },
  { value: "dj", label: "DJ" },
  { value: "dancer", label: "Dansçı" },
  { value: "musician", label: "Müzisyen" },
  { value: "performance_team", label: "Performans ekibi" },
  { value: "other", label: "Diğer" },
] as const;

export const serviceTypeOptions = [
  { value: "sound_system", label: "Ses sistemi" },
  { value: "lighting_system", label: "Işık sistemi" },
  { value: "stage", label: "Sahne" },
  { value: "operation_staff", label: "Operasyon personeli" },
  { value: "transportation", label: "Ulaşım" },
  { value: "accommodation", label: "Konaklama" },
  { value: "technical_service", label: "Teknik hizmet" },
  { value: "other", label: "Diğer" },
] as const;

export const packageTypeOptions = [
  { value: "program", label: "Program paketi" },
  { value: "wedding", label: "Düğün paketi" },
  { value: "corporate", label: "Kurumsal etkinlik paketi" },
  { value: "festival", label: "Festival paketi" },
  { value: "opening", label: "Açılış paketi" },
  { value: "private_party", label: "Özel parti paketi" },
  { value: "other", label: "Diğer" },
] as const;

export const programSectionOptions = [
  { value: "opening", label: "Açılış" },
  { value: "warm_up", label: "Isınma / Karşılama" },
  { value: "main_performance", label: "Ana performans" },
  { value: "support_performance", label: "Destek performans" },
  { value: "closing", label: "Kapanış" },
  { value: "technical", label: "Teknik hazırlık" },
  { value: "operation", label: "Operasyon" },
  { value: "other", label: "Diğer" },
] as const;

export function getOptionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value?: string | null
) {
  if (!value) {
    return "Belirtilmedi";
  }

  return options.find((option) => option.value === value)?.label ?? value;
}