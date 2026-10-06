import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page, type Schema } from "@/shared/api/client";

export type FinanceOverview = Schema<"FinanceOverview">;
export type CashAccount = Schema<"CashAccountRead">;
export type Movement = Schema<"Movement">;
export type Collection = Schema<"CollectionRead">;
export type CollectionCreate = Schema<"CollectionCreate">;
export type Payable = Schema<"PayableRead">;
export type PayableCreate = Schema<"PayableCreate">;
export type PayableUpdate = Schema<"PayableUpdate">;
export type PaymentCreate = Schema<"PaymentCreate">;
export type Payment = Schema<"PaymentRead">;
export type Expense = Schema<"ExpenseRead">;
export type ExpenseCreate = Schema<"ExpenseCreate">;
export type PartnerBalance = Schema<"PartnerBalance">;
export type PartnerTx = Schema<"PartnerTxRead">;
export type PartnerTxCreate = Schema<"PartnerTxCreate">;
export type StatementLine = Schema<"StatementLine">;
export type EventFinance = Schema<"EventFinance">;
export type PaymentPlan = Schema<"PaymentPlanRead">;
export type TransferCreate = Schema<"TransferCreate">;

const F = "/finance";

export function useOverview() {
  return useQuery({ queryKey: ["finance", "overview"], queryFn: () => api<FinanceOverview>(`${F}/overview`) });
}

export function useCashAccounts(enabled = true) {
  return useQuery({
    queryKey: ["finance", "cash-accounts"],
    queryFn: () => api<CashAccount[]>(`${F}/cash-accounts`),
    enabled,
  });
}

export function useMovements(accountId: number) {
  return useQuery({
    queryKey: ["finance", "movements", accountId],
    queryFn: () => api<Movement[]>(`${F}/cash-accounts/${accountId}/movements`),
    enabled: accountId > 0,
  });
}

export function useEventFinance(eventId: number) {
  return useQuery({
    queryKey: ["finance", "event", eventId],
    queryFn: () => api<EventFinance>(`${F}/events/${eventId}`),
    enabled: eventId > 0,
  });
}

export function useCollections(query: Record<string, string | number | undefined>) {
  return useQuery({
    queryKey: ["finance", "collections", query],
    queryFn: () => api<Page<Collection>>(`${F}/collections`, { query }),
  });
}

export function usePayables(query: Record<string, string | number | undefined>, enabled = true) {
  return useQuery({
    queryKey: ["finance", "payables", query],
    queryFn: () => api<Page<Payable>>(`${F}/payables`, { query }),
    enabled,
  });
}

export function useExpenses(query: Record<string, string | number | boolean | undefined>) {
  return useQuery({
    queryKey: ["finance", "expenses", query],
    queryFn: () => api<Page<Expense>>(`${F}/expenses`, { query }),
  });
}

export function usePartnerBalances() {
  return useQuery({ queryKey: ["finance", "partners"], queryFn: () => api<PartnerBalance[]>(`${F}/partners`) });
}

export function usePartnerStatement(partnerId: number) {
  return useQuery({
    queryKey: ["finance", "partner-statement", partnerId],
    queryFn: () => api<StatementLine[]>(`${F}/partners/${partnerId}/statement`),
    enabled: partnerId > 0,
  });
}

/** Sanatçı veya tedarikçi carisi (bakiye = şirketin ona kalan borcu). */
export function usePayeeStatement(kind: "artists" | "suppliers", id: number) {
  return useQuery({
    queryKey: ["finance", "payee-statement", kind, id],
    queryFn: () => api<StatementLine[]>(`${F}/${kind}/${id}/statement`),
    enabled: id > 0,
  });
}

export function useCustomerStatement(customerId: number) {
  return useQuery({
    queryKey: ["finance", "customer-statement", customerId],
    queryFn: () => api<StatementLine[]>(`${F}/customers/${customerId}/statement`),
  });
}

/** Her finans işleminden sonra tüm finans ekranları ve etkinlik özetleri tazelenir. */
function useFinanceMutation<TBody, TResult>(fn: (body: TBody) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export const useCreateCollection = () =>
  useFinanceMutation((body: CollectionCreate) => api<Collection>(`${F}/collections`, { method: "POST", body }));

export const useCancelCollection = () =>
  useFinanceMutation(({ id, reason }: { id: number; reason: string }) =>
    api<Collection>(`${F}/collections/${id}/cancel`, { method: "POST", body: { reason } }),
  );

export const useCreatePayable = () =>
  useFinanceMutation((body: PayableCreate) => api<Payable>(`${F}/payables`, { method: "POST", body }));

export const useUpdatePayable = () =>
  useFinanceMutation(({ id, body }: { id: number; body: PayableUpdate }) =>
    api<Payable>(`${F}/payables/${id}`, { method: "PATCH", body }),
  );

export const useCancelPayable = () =>
  useFinanceMutation(({ id, reason }: { id: number; reason: string }) =>
    api<Payable>(`${F}/payables/${id}/cancel`, { method: "POST", body: { reason } }),
  );

export const usePayPayable = () =>
  useFinanceMutation(({ id, body }: { id: number; body: PaymentCreate }) =>
    api<Payable>(`${F}/payables/${id}/payments`, { method: "POST", body }),
  );

export const useCancelPayment = () =>
  useFinanceMutation(({ id, reason }: { id: number; reason: string }) =>
    api<Payable>(`${F}/payments/${id}/cancel`, { method: "POST", body: { reason } }),
  );

export const useCreateExpense = () =>
  useFinanceMutation((body: ExpenseCreate) => api<Expense>(`${F}/expenses`, { method: "POST", body }));

export const useCancelExpense = () =>
  useFinanceMutation(({ id, reason }: { id: number; reason: string }) =>
    api<Expense>(`${F}/expenses/${id}/cancel`, { method: "POST", body: { reason } }),
  );

export const useCreatePartnerTx = () =>
  useFinanceMutation((body: PartnerTxCreate) => api<PartnerTx>(`${F}/partner-transactions`, { method: "POST", body }));

export const useCancelPartnerTx = () =>
  useFinanceMutation(({ id, reason }: { id: number; reason: string }) =>
    api<PartnerTx>(`${F}/partner-transactions/${id}/cancel`, { method: "POST", body: { reason } }),
  );

export const useCreateTransfer = () =>
  useFinanceMutation((body: TransferCreate) => api<{ id: number }>(`${F}/transfers`, { method: "POST", body }));

export const useCreateCashAccount = () =>
  useFinanceMutation((body: { name: string; account_type: "cash" | "bank"; currency: string; iban?: string | null }) =>
    api<CashAccount>(`${F}/cash-accounts`, { method: "POST", body }),
  );

export function usePartnerTransactions(partnerId?: number) {
  return useQuery({
    queryKey: ["finance", "partner-tx", partnerId],
    queryFn: () => api<PartnerTx[]>(`${F}/partner-transactions`, { query: { partner_id: partnerId } }),
  });
}

export const useSavePlan = (eventId: number) =>
  useFinanceMutation(({ id, body }: { id?: number; body: { title?: string; due_date?: string; amount?: string } }) =>
    id
      ? api<PaymentPlan[]>(`${F}/payment-plans/${id}`, { method: "PATCH", body })
      : api<PaymentPlan[]>(`${F}/events/${eventId}/payment-plans`, { method: "POST", body }),
  );

export const useDeletePlan = () =>
  useFinanceMutation((id: number) => api<PaymentPlan[]>(`${F}/payment-plans/${id}`, { method: "DELETE" }));
