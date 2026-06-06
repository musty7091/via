export type FinancialMovementSummary = {
  total_count: number;
  total_in_base_amount: number;
  total_out_base_amount: number;
  net_base_amount: number;
  company_cash_in_base_amount: number;
  company_cash_out_base_amount: number;
  partner_cash_in_base_amount: number;
  partner_cash_out_base_amount: number;
};

export type FinancialMovement = {
  id: number;
  movement_date: string;
  period_month: string | null;
  movement_type: string;
  account_area: string;
  direction: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  customer_effect: string;
  cash_effect: string;
  partner_effect: string;
  profit_effect: string;
  title: string;
  description: string | null;
  document_no: string | null;
  status: string;
};

export type FinancialMovementListResponse = {
  total_count: number;
  items: FinancialMovement[];
};

export type CarryForwardItem = {
  id: number;
  carry_type: string;
  status: string;
  source_period_month: string | null;
  target_period_month: string | null;
  event_id: number | null;
  customer_id: number | null;
  partner_id: number | null;
  artist_id: number | null;
  service_item_id: number | null;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  remaining_base_amount: number;
  carry_reason: string;
  notes: string | null;
};

export type PeriodExpenseSummary = {
  period_month: string;
  direct_general_expense_base_amount: number;
  allocated_expense_base_amount: number;
  total_period_expense_base_amount: number;
  allocation_count: number;
  direct_expense_count: number;
};

export type ExpenseAllocation = {
  id: number;
  expense_id: number;
  expense_title: string | null;
  period_month: string;
  allocated_base_amount: number;
  notes: string | null;
};

export type ExpenseRead = {
  id: number;
  expense_type: string;
  event_id: number | null;
  artist_id: number | null;
  paid_by_partner_id: number | null;
  paid_by_user_id: number | null;
  title: string;
  description: string | null;
  expense_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  is_allocated: boolean;
  allocation_start_month: string | null;
  allocation_end_month: string | null;
  status: string;
  document_no: string | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ExpenseWithAllocations = {
  expense: ExpenseRead;
  allocations: ExpenseAllocation[];
};

export type CreateExpensePayload = {
  title: string;
  description?: string | null;
  expense_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  expense_scope: "period" | "season";
  expense_type: string;
  allocation_end_month?: string | null;
  document_no?: string | null;
  notes?: string | null;
};

export type CancelExpensePayload = {
  cancellation_reason: string;
};

export type EventRead = {
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
  status: string;
  invoice_type: string;
  vat_rate: number;
  agreement_amount: number;
  agreement_currency: string;
  vat_amount: number;
  total_customer_amount: number;
  notes: string | null;
  is_period_closed: boolean;
  created_at: string;
  updated_at: string | null;
};

export type PartnerRead = {
  id: number;
  full_name: string;
  ownership_percent: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PaymentPlanRead = {
  id: number;
  event_id: number;
  title: string;
  due_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  paid_base_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CollectionRead = {
  id: number;
  event_id: number;
  payment_plan_id: number | null;
  customer_id: number;
  received_by_user_id: number | null;
  received_by_partner_id: number | null;
  collection_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  payment_method: string;
  current_location: string;
  is_transferred_to_company: boolean;
  transferred_at: string | null;
  document_no: string | null;
  notes: string | null;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string | null;
};

export type EventPaymentSummary = {
  event_id: number;
  event_total_amount: number;
  event_currency: string;
  event_base_total_amount: number;
  planned_base_amount: number;
  collected_base_amount: number;
  remaining_base_amount: number;
  unplanned_base_amount: number;
};

export type EventPaymentsDetail = {
  summary: EventPaymentSummary;
  payment_plans: PaymentPlanRead[];
  collections: CollectionRead[];
  cash_transfers: unknown[];
};

export type CreateCollectionPayload = {
  payment_plan_id?: number | null;
  received_by_partner_id?: number | null;
  collection_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  payment_method: string;
  document_no?: string | null;
  notes?: string | null;
};

export type CancelCollectionPayload = {
  cancellation_reason: string;
};

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
