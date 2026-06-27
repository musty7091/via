import { getStoredToken } from "../../../services/authStorage";
import type {
  CustomerListItem,
  CollectionRead,
  CreateCollectionPayload,
  CancelCollectionPayload,
  CashAccountRead,
  CashTransferCreatePayload,
  CashTransferRead,
  EventPaymentsDetail,
  EventRead,
  EventFinancialClosureReopenPayload,
  EventFinancialClosureRead,
  EventFinancialClosurePreparePayload,
  EventFinancialClosureChecklistResponse,
  EventFinancialClosureApprovePayload,
  PeriodClosePayload,
  PeriodCloseResponse,
  PeriodClosingPreviewResponse,
  PartnerRead,
  CancelExpensePayload,
  CarryForwardItem,
  CarryForwardSettlementPayload,
  CarryForwardSettlementResponse,
  CreateExpensePayload,
  ExpenseRead,
  ExpenseWithAllocations,
  FinancialMovementListResponse,
  FinancialMovementSummary,
  PeriodExpenseSummary,
  ArtistRead,
  ServiceItemRead,
  EventSupplierPayablesDetail,
  SupplierPaymentCancelPayload,
  SupplierPaymentCreatePayload,
  SupplierPaymentRead,
} from "../types/financeCenterTypes";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? `${window.location.origin}/api/v1`;

async function parseApiError(response: Response) {
  try {
    const data = await response.json();

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (Array.isArray(data.detail) && data.detail.length > 0) {
      return data.detail
        .map((item: { msg?: string }) => item.msg)
        .filter(Boolean)
        .join(" ");
    }

    if (data.detail && typeof data.detail.message === "string") {
      return data.detail.message;
    }

    return "İşlem başarısız oldu.";
  } catch {
    return "Sunucudan okunabilir hata mesajı alınamadı.";
  }
}

function getAuthHeaders() {
  const token = getStoredToken();

  if (!token) {
    throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchFinanceSummary(): Promise<FinancialMovementSummary> {
  return requestJson<FinancialMovementSummary>("/finance/movements/summary");
}

export async function fetchRecentFinanceMovements(params?: {
  skip?: number;
  limit?: number;
}): Promise<FinancialMovementListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("skip", String(params?.skip ?? 0));
  searchParams.set("limit", String(params?.limit ?? 5));

  return requestJson<FinancialMovementListResponse>(`/finance/movements?${searchParams.toString()}`);
}

export async function fetchOpenCarryForwards(): Promise<CarryForwardItem[]> {
  return requestJson<CarryForwardItem[]>("/carry-forwards/open");
}

export async function settleCarryForwardItem(
  itemId: number,
  payload: CarryForwardSettlementPayload
): Promise<CarryForwardSettlementResponse> {
  return requestJson<CarryForwardSettlementResponse>(`/carry-forwards/${itemId}/settle`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPeriodExpenseSummary(
  periodMonth: string
): Promise<PeriodExpenseSummary> {
  return requestJson<PeriodExpenseSummary>(`/expenses/period-summary/${periodMonth}`);
}

export async function createExpense(
  payload: CreateExpensePayload
): Promise<ExpenseWithAllocations> {
  return requestJson<ExpenseWithAllocations>("/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchExpenses(params?: {
  periodMonth?: string;
  expenseScope?: "period" | "season" | "";
}): Promise<ExpenseRead[]> {
  const searchParams = new URLSearchParams();

  if (params?.periodMonth) {
    searchParams.set("period_month", params.periodMonth);
  }

  if (params?.expenseScope) {
    searchParams.set("expense_scope", params.expenseScope);
  }

  const query = searchParams.toString();

  return requestJson<ExpenseRead[]>(`/expenses${query ? `?${query}` : ""}`);
}

export async function fetchExpenseDetail(expenseId: number): Promise<ExpenseWithAllocations> {
  return requestJson<ExpenseWithAllocations>(`/expenses/${expenseId}`);
}

export async function cancelExpense(
  expenseId: number,
  payload: CancelExpensePayload
): Promise<ExpenseRead> {
  return requestJson<ExpenseRead>(`/expenses/${expenseId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchEvents(): Promise<EventRead[]> {
  return requestJson<EventRead[]>("/events?limit=500");
}

export async function fetchEventPayments(eventId: number): Promise<EventPaymentsDetail> {
  return requestJson<EventPaymentsDetail>(`/events/${eventId}/payments`);
}

export async function fetchEventFinancialClosureChecklist(
  eventId: number
): Promise<EventFinancialClosureChecklistResponse> {
  return requestJson<EventFinancialClosureChecklistResponse>(
    `/events/${eventId}/financial-closure/checklist`
  );
}

export async function fetchLatestEventFinancialClosure(
  eventId: number
): Promise<EventFinancialClosureRead | null> {
  return requestJson<EventFinancialClosureRead | null>(
    `/events/${eventId}/financial-closure/latest`
  );
}

export async function prepareEventFinancialClosure(
  eventId: number,
  payload: EventFinancialClosurePreparePayload
): Promise<EventFinancialClosureRead> {
  return requestJson<EventFinancialClosureRead>(
    `/events/${eventId}/financial-closure/prepare`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function approveEventFinancialClosure(
  eventId: number,
  payload: EventFinancialClosureApprovePayload
): Promise<EventFinancialClosureRead> {
  return requestJson<EventFinancialClosureRead>(
    `/events/${eventId}/financial-closure/approve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function reopenEventFinancialClosure(
  eventId: number,
  payload: EventFinancialClosureReopenPayload
): Promise<EventFinancialClosureRead> {
  return requestJson<EventFinancialClosureRead>(
    `/events/${eventId}/financial-closure/reopen`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}


export async function fetchPeriodClosingPreview(
  periodMonth: string
): Promise<PeriodClosingPreviewResponse> {
  return requestJson<PeriodClosingPreviewResponse>(`/period-closing/${periodMonth}/preview`);
}

export async function closePeriod(
  periodMonth: string,
  payload: PeriodClosePayload
): Promise<PeriodCloseResponse> {
  return requestJson<PeriodCloseResponse>(`/period-closing/${periodMonth}/close`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPartners(): Promise<PartnerRead[]> {
  return requestJson<PartnerRead[]>("/partners?is_active=true");
}

export async function createCollection(
  eventId: number,
  payload: CreateCollectionPayload
): Promise<CollectionRead> {
  return requestJson<CollectionRead>(`/events/${eventId}/payments/collections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelCollection(
  eventId: number,
  collectionId: number,
  payload: CancelCollectionPayload
): Promise<CollectionRead> {
  return requestJson<CollectionRead>(
    `/events/${eventId}/payments/collections/${collectionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchCustomers(): Promise<CustomerListItem[]> {
  return requestJson<CustomerListItem[]>("/customers?is_active=true&limit=500");
}

export async function fetchCashAccounts(): Promise<CashAccountRead[]> {
  return requestJson<CashAccountRead[]>("/finance/cash-accounts?is_active=true");
}

export async function transferCollectionToCompany(
  eventId: number,
  collectionId: number,
  payload: CashTransferCreatePayload
): Promise<CashTransferRead> {
  return requestJson<CashTransferRead>(
    `/events/${eventId}/payments/collections/${collectionId}/transfer-to-company`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchArtists(): Promise<ArtistRead[]> {
  return requestJson<ArtistRead[]>("/service-catalog/artists?is_active=true&limit=500");
}

export async function fetchServiceItems(): Promise<ServiceItemRead[]> {
  return requestJson<ServiceItemRead[]>("/service-catalog/services?is_active=true&limit=500");
}

export async function fetchSupplierPayables(
  eventId: number
): Promise<EventSupplierPayablesDetail> {
  return requestJson<EventSupplierPayablesDetail>(`/events/${eventId}/supplier-payables`);
}

export async function createSupplierPayment(
  eventId: number,
  payableId: number,
  payload: SupplierPaymentCreatePayload
): Promise<SupplierPaymentRead> {
  return requestJson<SupplierPaymentRead>(
    `/events/${eventId}/supplier-payables/${payableId}/payments`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function cancelSupplierPayment(
  eventId: number,
  payableId: number,
  paymentId: number,
  payload: SupplierPaymentCancelPayload
): Promise<SupplierPaymentRead> {
  return requestJson<SupplierPaymentRead>(
    `/events/${eventId}/supplier-payables/${payableId}/payments/${paymentId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
