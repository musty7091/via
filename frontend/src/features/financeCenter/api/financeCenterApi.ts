import { getStoredToken } from "../../../services/authStorage";
import type {
  CarryForwardItem,
  CreateExpensePayload,
  ExpenseWithAllocations,
  FinancialMovementListResponse,
  FinancialMovementSummary,
  PeriodExpenseSummary,
} from "../types/financeCenterTypes";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

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

export async function fetchRecentFinanceMovements(): Promise<FinancialMovementListResponse> {
  return requestJson<FinancialMovementListResponse>("/finance/movements?limit=8");
}

export async function fetchOpenCarryForwards(): Promise<CarryForwardItem[]> {
  return requestJson<CarryForwardItem[]>("/carry-forwards/open");
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
