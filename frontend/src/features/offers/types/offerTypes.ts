export type Currency = "TRY" | "EUR" | "GBP" | "USD";

export type CustomerOption = {
  id: number;
  name: string;
  short_name: string | null;
  city: string | null;
  phone: string | null;
  default_currency: Currency;
  is_active: boolean;
};

export type VenueOption = {
  id: number;
  customer_id: number;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
};

export type PackageOption = {
  id: number;
  package_type: string;
  name: string;
  description: string | null;
  default_sale_amount: number;
  default_sale_currency: Currency;
  is_active: boolean;
};

export type OfferStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "agreement"
  | "rejected"
  | "cancelled";

export type InvoiceType = "without_invoice" | "with_invoice";

export type OfferSourceType =
  | "manual"
  | "artist"
  | "technical_service"
  | "package_total"
  | "package_component";

export type OfferListItem = {
  id: number;
  event_id: number | null;
  customer_id: number;
  venue_id: number | null;
  package_id: number | null;
  offer_no: string | null;
  title: string;
  status: OfferStatus;
  offer_date: string | null;
  event_date: string | null;
  valid_until: string | null;
  invoice_type: InvoiceType;
  vat_rate: number;
  amount: number;
  currency: Currency;
  vat_amount: number;
  total_amount: number;
  advance_payment_amount: number;
  advance_payment_currency: Currency;
  payment_terms: string | null;
  customer_visible_notes: string | null;
  internal_notes: string | null;
  agreement_notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type OfferCreatePayload = {
  customer_id: number;
  venue_id?: number | null;
  package_id?: number | null;
  title: string;
  offer_date?: string | null;
  event_date?: string | null;
  valid_until?: string | null;
  invoice_type: InvoiceType;
  vat_rate: number;
  currency: Currency;
  advance_payment_amount: number;
  advance_payment_currency: Currency;
  payment_terms?: string | null;
  customer_visible_notes?: string | null;
  internal_notes?: string | null;
};

export type OfferUpdatePayload = Partial<OfferCreatePayload>;

export type OfferItem = {
  id: number;
  offer_id: number;
  source_type: OfferSourceType;
  source_package_item_id: number | null;
  artist_id: number | null;
  service_item_id: number | null;
  title: string;
  description: string;
  program_section: string | null;
  start_time: string | null;
  end_time: string | null;
  quantity: number;
  unit_price: number;
  currency: Currency;
  base_amount: number;
  is_visible_on_offer: boolean;
  is_active: boolean;
  sort_order: number;
  internal_unit_cost: number;
  internal_cost_currency: Currency;
  internal_total_cost: number;
  internal_profit: number;
  created_at: string;
  updated_at: string | null;
};

export type OfferItemCreatePayload = {
  source_type?: "manual" | "artist" | "technical_service";
  artist_id?: number | null;
  service_item_id?: number | null;
  title: string;
  description: string;
  program_section?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  quantity: number;
  unit_price: number;
  currency: Currency;
  internal_unit_cost: number;
  internal_cost_currency: Currency;
  is_visible_on_offer: boolean;
  sort_order: number;
};

export type OfferSummary = {
  currency: Currency;
  visible_amount: number;
  vat_amount: number;
  total_amount: number;
};

export type OfferInternalSummary = {
  currency: Currency;
  revenue_amount: number;
  cost_amount: number;
  gross_profit_amount: number;
};

export type OfferDetail = {
  offer: OfferListItem;
  items: OfferItem[];
  visible_summaries: OfferSummary[];
  internal_summaries: OfferInternalSummary[];
};

export type OfferPrintLine = {
  sort_order: number;
  title: string;
  description: string;
  program_section: string | null;
  start_time: string | null;
  end_time: string | null;
  quantity: number;
  unit_price: number;
  currency: Currency;
  line_amount: number;
  show_pricing: boolean;
};

export type OfferPrintView = {
  offer_id: number;
  offer_no: string | null;
  title: string;
  customer_name: string;
  venue_name: string | null;
  event_date: string | null;
  valid_until: string | null;
  invoice_type: InvoiceType;
  vat_rate: number;
  customer_visible_notes: string | null;
  payment_terms: string | null;
  advance_payment_amount: number;
  advance_payment_currency: Currency;
  lines: OfferPrintLine[];
  summaries: OfferSummary[];
};