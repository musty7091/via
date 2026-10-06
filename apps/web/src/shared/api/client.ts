import type { components } from "./schema";

/** Backend şemalarından üretilen tipler. Örn: `Schema<"UserRead">` */
export type Schema<Name extends keyof components["schemas"]> = components["schemas"][Name];

export interface Page<T> {
  items: T[];
  total: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const UNAUTHENTICATED_EVENT = "via:unauthenticated";

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  if (body?.error) return new ApiError(response.status, body.error.code, body.error.message);
  if (response.status === 422 && Array.isArray(body?.detail)) {
    // Form doğrulama hatası: ilk hatayı anlaşılır şekilde göster.
    return new ApiError(422, "validation_error", "Lütfen formdaki alanları kontrol edin.");
  }
  return new ApiError(response.status, "unknown", "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
}

/** Tüm API çağrıları buradan geçer. Hata mesajları kullanıcıya gösterilecek Türkçe metindir. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: {
        "X-Requested-With": "via",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network", "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.");
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}
