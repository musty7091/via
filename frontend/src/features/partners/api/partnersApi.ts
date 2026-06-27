import { getStoredToken } from "../../../services/authStorage";
import type { Partner, PartnerCreatePayload, PartnerUpdatePayload } from "../types/partnerTypes";

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

export async function fetchPartners(): Promise<Partner[]> {
  return requestJson<Partner[]>("/partners");
}

export async function createPartner(
  payload: PartnerCreatePayload
): Promise<Partner> {
  return requestJson<Partner>("/partners", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePartner(
  partnerId: number,
  payload: PartnerUpdatePayload
): Promise<Partner> {
  return requestJson<Partner>(`/partners/${partnerId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
