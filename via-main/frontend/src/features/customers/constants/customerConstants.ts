export const customerTypeOptions = [
  { value: "company", label: "Şirket" },
  { value: "hotel", label: "Otel" },
  { value: "restaurant", label: "Restoran" },
  { value: "venue", label: "Mekân" },
  { value: "organizer", label: "Organizatör" },
  { value: "agency", label: "Ajans" },
  { value: "municipality", label: "Belediye / Kurum" },
  { value: "individual", label: "Bireysel" },
  { value: "other", label: "Diğer" },
];

export const customerStatusOptions = [
  { value: "candidate", label: "Aday" },
  { value: "active", label: "Aktif" },
  { value: "passive", label: "Pasif" },
  { value: "risky", label: "Riskli" },
  { value: "blacklist", label: "Kara liste" },
];

export const invoiceTypeOptions = [
  { value: "select_on_event", label: "Etkinlikte seçilsin" },
  { value: "with_invoice", label: "Faturalı" },
  { value: "without_invoice", label: "Faturasız" },
];

export const currencyOptions = [
  { value: "TRY", label: "TRY" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "USD", label: "USD" },
];

export const riskLevelOptions = [
  { value: "normal", label: "Normal" },
  { value: "watch", label: "Takip" },
  { value: "risky", label: "Riskli" },
  { value: "blocked", label: "Blokeli" },
];

export const contactRoleOptions = [
  { value: "decision_maker", label: "Karar verici" },
  { value: "accounting", label: "Muhasebe" },
  { value: "operation", label: "Operasyon" },
  { value: "purchasing", label: "Satın alma" },
  { value: "event_responsible", label: "Etkinlik sorumlusu" },
  { value: "general_manager", label: "Genel müdür" },
  { value: "other", label: "Diğer" },
];

export const venueTypeOptions = [
  { value: "hotel", label: "Otel" },
  { value: "restaurant", label: "Restoran" },
  { value: "wedding_hall", label: "Düğün salonu" },
  { value: "open_air", label: "Açık alan" },
  { value: "concert_area", label: "Konser alanı" },
  { value: "club", label: "Club" },
  { value: "corporate_area", label: "Kurumsal alan" },
  { value: "other", label: "Diğer" },
];

export const ledgerMovementTypeOptions = [
  { value: "opening_balance", label: "Açılış bakiyesi" },
  { value: "event_charge", label: "Etkinlik bedeli" },
  { value: "deposit_collection", label: "Kapora tahsilatı" },
  { value: "partial_collection", label: "Ara ödeme" },
  { value: "final_collection", label: "Kalan ödeme" },
  { value: "refund", label: "İade" },
  { value: "discount_adjustment", label: "İndirim / düzeltme" },
  { value: "exchange_difference", label: "Kur farkı" },
  { value: "manual_adjustment", label: "Manuel düzeltme" },
  { value: "reverse_entry", label: "Ters kayıt" },
];

export const paymentMethodOptions = [
  { value: "cash", label: "Nakit" },
  { value: "bank_transfer", label: "Banka" },
  { value: "credit_card", label: "Kredi kartı" },
  { value: "check", label: "Çek" },
  { value: "other", label: "Diğer" },
];

export function getOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  return options.find((item) => item.value === value)?.label ?? value;
}