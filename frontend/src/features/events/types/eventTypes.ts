export type Currency = "TRY" | "EUR" | "GBP" | "USD";

export type EventStatus =
  | "planned"
  | "preparation"
  | "completed"
  | "cancelled"
  | "draft";

export type EventListItem = {
  id: number;
  event_code: string | null;
  title: string;
  customer_id: number;
  venue_id: number | null;
  responsible_partner_id: number | null;
  operation_user_id: number | null;
  event_date: string;
  start_datetime: string | null;
  end_datetime: string | null;
  status: EventStatus;
  invoice_type: string;
  vat_rate: number;
  agreement_amount: number;
  agreement_currency: Currency;
  vat_amount: number;
  total_customer_amount: number;
  notes: string | null;
  is_period_closed: boolean;
  created_at: string;
  updated_at: string | null;
};

export type EventItem = {
  id: number;
  event_id: number;
  item_type: string;
  artist_id: number | null;
  service_item_id: number | null;
  description: string | null;
  sale_amount: number;
  sale_currency: Currency;
  cost_amount: number;
  cost_currency: Currency;
  exchange_rate: number;
  base_sale_amount: number;
  base_cost_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
};

export type EventDetail = {
  event: EventListItem;
  items: EventItem[];
};

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

export type EventCurrencySummary = {
  currency: Currency;
  revenueAmount: number;
  costAmount: number;
  grossProfitAmount: number;
};
