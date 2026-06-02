export type PaymentPlanStatus = "pending" | "partial" | "paid";

export type PaymentPlan = {
  id: number;
  event_id: number;
  title: string;
  due_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number;
  paid_base_amount: number;
  status: PaymentPlanStatus;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PaymentPlanCreatePayload = {
  title: string;
  due_date: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  notes?: string | null;
};

export type PaymentPlanUpdatePayload = Partial<PaymentPlanCreatePayload>;

export type EventCollection = {
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

export type CollectionCreatePayload = {
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

export type CollectionCancelPayload = {
  cancellation_reason: string;
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
  payment_plans: PaymentPlan[];
  collections: EventCollection[];
};
