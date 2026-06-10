export type CustomerListItem = {
  id: number;
  customer_type: string;
  customer_status: string;
  name: string;
  short_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  default_currency: string;
  risk_level: string;
  is_active: boolean;
  created_at: string;
};

export type CustomerDetail = {
  id: number;
  customer_type: string;
  customer_status: string;
  name: string;
  short_name: string | null;
  tax_number: string | null;
  tax_office: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  default_invoice_type: string | null;
  default_currency: string;
  default_payment_term_days: number | null;
  risk_level: string;
  risk_note: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CustomerCreatePayload = {
  customer_type: string;
  customer_status: string;
  name: string;
  short_name?: string | null;
  tax_number?: string | null;
  tax_office?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  default_invoice_type?: string | null;
  default_currency: string;
  default_payment_term_days?: number | null;
  risk_level: string;
  risk_note?: string | null;
  is_active: boolean;
  notes?: string | null;
};

export type CustomerUpdatePayload = Partial<CustomerCreatePayload>;

export type CustomerContact = {
  id: number;
  customer_id: number;
  full_name: string;
  title: string | null;
  contact_role: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  is_primary_contact: boolean;
  is_accounting_contact: boolean;
  is_operation_contact: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CustomerContactCreatePayload = {
  full_name: string;
  title?: string | null;
  contact_role?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  email?: string | null;
  is_primary_contact: boolean;
  is_accounting_contact: boolean;
  is_operation_contact: boolean;
  is_active: boolean;
  notes?: string | null;
};

export type CustomerVenue = {
  id: number;
  customer_id: number | null;
  name: string;
  venue_type: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  capacity: number | null;
  stage_info: string | null;
  technical_notes: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type CustomerVenueCreatePayload = {
  name: string;
  venue_type?: string | null;
  country?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  capacity?: number | null;
  stage_info?: string | null;
  technical_notes?: string | null;
  notes?: string | null;
  is_active: boolean;
};

export type CustomerLedgerMovement = {
  id: number;
  customer_id: number;
  event_id: number | null;
  event_title: string | null;
  collection_id: number | null;
  payment_plan_id: number | null;
  movement_date: string;
  movement_type: string;
  direction: "debit" | "credit";
  title: string;
  description: string | null;
  detail_note: string | null;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  debit_base_amount: number;
  credit_base_amount: number;
  running_balance_base_amount: number;
  payment_method: string | null;
  collected_by_partner_id: number | null;
  collected_by_partner_name: string | null;
  created_by_user_id: number | null;
  document_no: string | null;
  reference_type: string | null;
  reference_id: number | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CustomerLedgerMovementCreatePayload = {
  movement_date: string;
  movement_type: string;
  direction: "debit" | "credit";
  title: string;
  description?: string | null;
  detail_note?: string | null;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount?: number | null;
  payment_method?: string | null;
  collected_by_partner_id?: number | null;
  document_no?: string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  notes?: string | null;
};

export type CustomerLedgerSummary = {
  customer_id: number;
  total_debit_base_amount: number;
  total_credit_base_amount: number;
  balance_base_amount: number;
  movement_count: number;
  last_movement_date: string | null;
};

export type CustomerDetailBundle = {
  customer: CustomerDetail;
  contacts: CustomerContact[];
  venues: CustomerVenue[];
  ledger: CustomerLedgerMovement[];
  summary: CustomerLedgerSummary;
};