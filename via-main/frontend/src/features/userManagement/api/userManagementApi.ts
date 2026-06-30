import { getStoredToken } from "../../../services/authStorage";
import type {
  ManagedUser,
  ManagedUserCreatePayload,
  ManagedUserPasswordResetPayload,
  ManagedUserUpdatePayload,
} from "../types/userManagementTypes";

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

function buildUrl(path: string, params?: Record<string, string | boolean | null | undefined>) {
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

export async function fetchManagedUsers(params?: {
  search?: string;
  isActive?: boolean | null;
}): Promise<ManagedUser[]> {
  return requestJson<ManagedUser[]>(
    buildUrl("/users", {
      search: params?.search,
      is_active: params?.isActive,
    })
  );
}

export async function createManagedUser(
  payload: ManagedUserCreatePayload
): Promise<ManagedUser> {
  return requestJson<ManagedUser>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateManagedUser(
  userId: number,
  payload: ManagedUserUpdatePayload
): Promise<ManagedUser> {
  return requestJson<ManagedUser>(`/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function resetManagedUserPassword(
  userId: number,
  payload: ManagedUserPasswordResetPayload
): Promise<ManagedUser> {
  return requestJson<ManagedUser>(`/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
