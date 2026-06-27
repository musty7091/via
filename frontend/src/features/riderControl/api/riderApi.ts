import { getStoredToken } from "../../../services/authStorage";
import type {
  EventOption,
  GenerateResult,
  RiderCheck,
  RiderCheckBoard,
  RiderCheckCreatePayload,
  RiderCheckUpdatePayload,
} from "../types/riderTypes";

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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function fetchEventOptions(): Promise<EventOption[]> {
  const data = await requestJson<EventOption[]>("/events?limit=200");
  return data.map((event) => ({
    id: event.id,
    title: event.title,
    event_date: event.event_date,
    status: event.status,
  }));
}

export async function fetchRiderBoard(
  eventId: number
): Promise<RiderCheckBoard> {
  return requestJson<RiderCheckBoard>(
    `/operations/events/${eventId}/rider-checks`
  );
}

export async function generateRiderChecks(
  eventId: number
): Promise<GenerateResult> {
  return requestJson<GenerateResult>(
    `/operations/events/${eventId}/rider-checks/generate`,
    { method: "POST" }
  );
}

export async function createRiderCheck(
  eventId: number,
  payload: RiderCheckCreatePayload
): Promise<RiderCheck> {
  return requestJson<RiderCheck>(
    `/operations/events/${eventId}/rider-checks`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateRiderCheck(
  checkId: number,
  payload: RiderCheckUpdatePayload
): Promise<RiderCheck> {
  return requestJson<RiderCheck>(`/operations/rider-checks/${checkId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteRiderCheck(checkId: number): Promise<void> {
  await requestJson<void>(`/operations/rider-checks/${checkId}`, {
    method: "DELETE",
  });
}
