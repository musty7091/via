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
