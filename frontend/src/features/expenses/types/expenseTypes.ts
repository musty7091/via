export type ExpenseScope = "period" | "season";

export type ExpenseTabKey = "event" | "general" | "distributed";

export type ExpenseCurrency = "TRY" | "USD" | "EUR" | "GBP";

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

export type EventExpense = ExpenseRead & {
  expense_type: "event" | string;
  event_id: number;
  is_allocated: false;
};

export type GeneralMonthlyExpense = ExpenseRead & {
  event_id: null;
  is_allocated: false;
};

export type DistributedExpense = ExpenseRead & {
  is_allocated: true;
  allocation_start_month: string;
  allocation_end_month: string;
};

export type ExpenseAllocation = {
  id: number;
  expense_id: number;
  expense_title: string | null;
  period_month: string;
  allocated_base_amount: number;
  notes: string | null;
};

export type ExpenseWithAllocations = {
  expense: ExpenseRead;
  allocations: ExpenseAllocation[];
};

export type ExpenseCreatePayload = {
  title: string;
  description?: string | null;
  expense_date: string;
  amount: number;
  currency: ExpenseCurrency | string;
  exchange_rate: number;
  expense_scope: ExpenseScope;
  expense_type: string;
  event_id?: number | null;
  artist_id?: number | null;
  paid_by_partner_id?: number | null;
  paid_by_user_id?: number | null;
  allocation_end_month?: string | null;
  document_no?: string | null;
  notes?: string | null;
};

export type ExpenseCancelPayload = {
  cancellation_reason: string;
};

export type PeriodExpenseSummary = {
  period_month: string;
  direct_general_expense_base_amount: number;
  allocated_expense_base_amount: number;
  total_period_expense_base_amount: number;
  allocation_count: number;
  direct_expense_count: number;
};

export type ExpenseListParams = {
  periodMonth?: string;
  expenseScope?: ExpenseScope | "";
};

export type ExpenseEventOption = {
  id: number;
  event_code: string | null;
  title: string;
  event_date: string;
  status: string;
  total_customer_amount: number;
  agreement_currency: string;
};

export type ExpensePartnerOption = {
  id: number;
  full_name: string;
  ownership_percent: number;
  is_active: boolean;
};
