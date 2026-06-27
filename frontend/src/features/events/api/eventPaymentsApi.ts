import { getStoredToken } from "../../../services/authStorage";
import type {
  CollectionCancelPayload,
  CollectionCreatePayload,
  EventCollection,
  EventPaymentsDetail,
  PaymentPlan,
  PaymentPlanCreatePayload,
  PaymentPlanUpdatePayload,
} from "../types/eventPaymentTypes";

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

export async function fetchEventPayments(
  eventId: number
): Promise<EventPaymentsDetail> {
  return requestJson<EventPaymentsDetail>(`/events/${eventId}/payments`);
}

export async function createPaymentPlan(
  eventId: number,
  payload: PaymentPlanCreatePayload
): Promise<PaymentPlan> {
  return requestJson<PaymentPlan>(`/events/${eventId}/payments/plans`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePaymentPlan(
  eventId: number,
  paymentPlanId: number,
  payload: PaymentPlanUpdatePayload
): Promise<PaymentPlan> {
  return requestJson<PaymentPlan>(
    `/events/${eventId}/payments/plans/${paymentPlanId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

export async function createCollection(
  eventId: number,
  payload: CollectionCreatePayload
): Promise<EventCollection> {
  return requestJson<EventCollection>(`/events/${eventId}/payments/collections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelCollection(
  eventId: number,
  collectionId: number,
  payload: CollectionCancelPayload
): Promise<EventCollection> {
  return requestJson<EventCollection>(
    `/events/${eventId}/payments/collections/${collectionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
