import { getStoredToken } from "../../../services/authStorage";
import type {
  ExpenseAllocation,
  ExpenseCancelPayload,
  ExpenseCreatePayload,
  ExpenseEventOption,
  ExpenseListParams,
  ExpensePartnerOption,
  ExpenseRead,
  ExpenseWithAllocations,
  PeriodExpenseSummary,
} from "../types/expenseTypes";

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

function buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

async function requestJson<T>(url: URL | string, options?: RequestInit): Promise<T> {
  const requestUrl =
    typeof url === "string" && url.startsWith("/")
      ? `${API_BASE_URL}${url}`
      : url.toString();

  const response = await fetch(requestUrl, {
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

export async function fetchExpenses(params?: ExpenseListParams): Promise<ExpenseRead[]> {
  return requestJson<ExpenseRead[]>(
    buildUrl("/expenses", {
      period_month: params?.periodMonth,
      expense_scope: params?.expenseScope,
    })
  );
}

export async function createExpense(payload: ExpenseCreatePayload): Promise<ExpenseWithAllocations> {
  return requestJson<ExpenseWithAllocations>("/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchExpenseDetail(expenseId: number): Promise<ExpenseWithAllocations> {
  return requestJson<ExpenseWithAllocations>(`/expenses/${expenseId}`);
}

export async function fetchExpenseAllocations(expenseId: number): Promise<ExpenseAllocation[]> {
  return requestJson<ExpenseAllocation[]>(`/expenses/${expenseId}/allocations`);
}

export async function fetchPeriodExpenseSummary(periodMonth: string): Promise<PeriodExpenseSummary> {
  return requestJson<PeriodExpenseSummary>(`/expenses/period-summary/${periodMonth}`);
}

export async function fetchPeriodAllocations(periodMonth: string): Promise<ExpenseAllocation[]> {
  return requestJson<ExpenseAllocation[]>(`/expenses/allocations/${periodMonth}`);
}

export async function cancelExpense(
  expenseId: number,
  payload: ExpenseCancelPayload
): Promise<ExpenseRead> {
  return requestJson<ExpenseRead>(`/expenses/${expenseId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchExpenseEventOptions(): Promise<ExpenseEventOption[]> {
  return requestJson<ExpenseEventOption[]>(buildUrl("/events", { limit: 500 }));
}

export async function fetchExpensePartnerOptions(): Promise<ExpensePartnerOption[]> {
  return requestJson<ExpensePartnerOption[]>(buildUrl("/partners", { is_active: true }));
}
