/**
 * Backend'deki seçenek değerlerinin ekranda görünen Türkçe karşılıkları.
 * KURAL: Ekranda teknik değer (ör. "dance_group") asla gösterilmez; her zaman buradan çevrilir.
 */

import type { BadgeTone } from "@/shared/ui/Badge";

export type Option<T extends string = string> = { value: T; label: string };

function options<T extends string>(labels: Record<T, string>): Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const CUSTOMER_TYPE_LABELS = {
  company: "Şirket",
  hotel: "Otel",
  restaurant: "Restoran",
  venue: "Mekân işletmesi",
  organizer: "Organizatör",
  agency: "Ajans",
  public: "Kamu kurumu",
  individual: "Bireysel",
  other: "Diğer",
} as const;

export const INVOICE_LABELS = {
  with_invoice: "Faturalı",
  without_invoice: "Faturasız",
} as const;

export const RISK_LABELS = {
  normal: "Normal",
  watch: "Takipte",
  blocked: "Engelli (teklif verilmez)",
} as const;

export const VENUE_TYPE_LABELS = {
  hotel: "Otel",
  restaurant: "Restoran",
  hall: "Salon",
  beach: "Plaj",
  open_air: "Açık alan",
  club: "Kulüp",
  other: "Diğer",
} as const;

export const ARTIST_TYPE_LABELS = {
  solo: "Solo sanatçı",
  band: "Grup / orkestra",
  dj: "DJ",
  dancer: "Dansçı",
  dance_group: "Dans topluluğu",
  presenter: "Sunucu",
  other: "Diğer",
} as const;

export const SERVICE_TYPE_LABELS = {
  sound: "Ses",
  light: "Işık",
  stage: "Sahne",
  screen: "LED ekran",
  photo_video: "Foto / video",
  decoration: "Dekorasyon",
  catering: "İkram",
  transport: "Ulaşım",
  staff: "Personel",
  other: "Diğer",
} as const;

export const SERVICE_UNIT_LABELS = {
  piece: "Adet",
  day: "Gün",
  hour: "Saat",
  person: "Kişi",
  set: "Set",
} as const;

export const RIDER_CATEGORY_LABELS = {
  technical: "Teknik",
  backstage: "Kulis",
  hospitality: "İkram / konaklama",
  transport: "Ulaşım",
  other: "Diğer",
} as const;

export const PACKAGE_TYPE_LABELS = {
  program: "Program paketi",
  technical: "Teknik paket",
  combo: "Kombo paket",
} as const;

export const COMPONENT_TYPE_LABELS = {
  artist: "Sanatçı",
  service: "Hizmet",
  custom: "Serbest kalem",
} as const;

export const PROGRAM_SECTION_LABELS = {
  opening: "Açılış",
  warmup: "Isınma",
  main: "Ana performans",
  support: "Destek performans",
  closing: "Kapanış",
  technical: "Teknik",
  other: "Diğer",
} as const;

export const customerTypeOptions = options(CUSTOMER_TYPE_LABELS);
export const invoiceOptions = options(INVOICE_LABELS);
export const riskOptions = options(RISK_LABELS);
export const venueTypeOptions = options(VENUE_TYPE_LABELS);
export const artistTypeOptions = options(ARTIST_TYPE_LABELS);
export const serviceTypeOptions = options(SERVICE_TYPE_LABELS);
export const serviceUnitOptions = options(SERVICE_UNIT_LABELS);
export const riderCategoryOptions = options(RIDER_CATEGORY_LABELS);
export const packageTypeOptions = options(PACKAGE_TYPE_LABELS);
export const componentTypeOptions = options(COMPONENT_TYPE_LABELS);
export const programSectionOptions = options(PROGRAM_SECTION_LABELS);

export const OFFER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Taslak", tone: "neutral" },
  sent: { label: "Gönderildi", tone: "info" },
  accepted: { label: "Kabul edildi", tone: "success" },
  rejected: { label: "Reddedildi", tone: "danger" },
  cancelled: { label: "İptal", tone: "neutral" },
  converted: { label: "Anlaşma", tone: "brand" },
};

export const offerStatusOptions: Option[] = Object.entries(OFFER_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

export const EVENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  planned: { label: "Planlandı", tone: "info" },
  completed: { label: "Gerçekleşti", tone: "success" },
  cancelled: { label: "İptal", tone: "neutral" },
};

export const eventStatusOptions: Option[] = Object.entries(EVENT_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

export const PAYMENT_METHOD_LABELS = {
  cash: "Nakit",
  bank_transfer: "Havale / EFT",
  card: "Kredi kartı",
  cheque: "Çek",
  other: "Diğer",
} as const;

export const EXPENSE_CATEGORY_LABELS = {
  rent: "Kira",
  salary: "Maaş / personel",
  transport: "Ulaşım / yakıt",
  marketing: "Reklam / tanıtım",
  office: "Ofis",
  tax_fees: "Vergi / harç",
  equipment: "Ekipman / teknik",
  food: "Yemek / ikram",
  other: "Diğer",
} as const;

export const EXPENSE_PAID_BY_LABELS = {
  company: "Şirket ödedi (kasa/banka)",
  partner: "Ortak cebinden ödedi",
  unpaid: "Henüz ödenmedi (borç)",
} as const;

export const PARTNER_TX_LABELS = {
  handover: "Kasaya teslim",
  payout: "Ortağa ödeme",
  offset: "Mahsup",
} as const;

export const ENTRY_KIND_LABELS: Record<string, string> = {
  agreement: "Anlaşma",
  payable: "Borç",
  payable_adjustment: "Borç düzeltme",
  collection: "Tahsilat",
  supplier_payment: "Ödeme",
  expense: "Gider",
  partner_handover: "Ortak teslimi",
  partner_payout: "Ortağa ödeme",
  partner_offset: "Mahsup",
  cash_transfer: "Transfer",
  reversal: "İptal (ters kayıt)",
};

export const PAYABLE_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "Ödenmedi", tone: "warning" },
  partial: { label: "Kısmi ödendi", tone: "info" },
  paid: { label: "Ödendi", tone: "success" },
  cancelled: { label: "İptal", tone: "neutral" },
};

export const PLAN_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  paid: { label: "Tahsil edildi", tone: "success" },
  partial: { label: "Kısmi", tone: "info" },
  open: { label: "Bekliyor", tone: "neutral" },
  overdue: { label: "Gecikti", tone: "danger" },
};

export const paymentMethodOptions = options(PAYMENT_METHOD_LABELS);
export const expenseCategoryOptions = options(EXPENSE_CATEGORY_LABELS);

export const ACCOUNT_LABELS: Record<string, string> = {
  cash: "Kasa / banka",
  customer_receivable: "Müşteri alacağı",
  partner_cash: "Ortak üzerindeki para",
  supplier_payable: "Sanatçı / tedarikçi borcu",
  partner_payable: "Şirketin ortağa borcu",
  vat_payable: "KDV",
  revenue: "Gelir",
  event_cost: "Etkinlik maliyeti",
  expense: "Gider",
  fx_difference: "Kur farkı",
};

export const TASK_CATEGORY_LABELS = {
  setup: "Hazırlık",
  technical: "Teknik",
  artist: "Sanatçı",
  hospitality: "Kulis / ikram",
  transport: "Ulaşım",
  teardown: "Söküm",
  other: "Diğer",
} as const;

export const taskCategoryOptions = options(TASK_CATEGORY_LABELS);

export const RIDER_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Bekliyor", tone: "neutral" },
  ok: { label: "Tamam", tone: "success" },
  problem: { label: "Sorun var", tone: "danger" },
  not_needed: { label: "Gerekmiyor", tone: "info" },
};
