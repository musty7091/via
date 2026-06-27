import type { AuthUser, LoginPayload, LoginResponse } from "../types/auth";
import { getStoredToken } from "./authStorage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

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

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = getStoredToken();

  if (!token) {
    throw new Error("Oturum bulunamadı.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function getHealthStatus() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error("API sağlık kontrolü başarısız oldu.");
  }

  return response.json();
}