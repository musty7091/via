import { getStoredToken } from "../../../services/authStorage";
import type {
  CustomerOption,
  OfferCreatePayload,
  OfferDetail,
  OfferItem,
  OfferItemCreatePayload,
  OfferListItem,
  OfferPrintView,
  OfferUpdatePayload,
  PackageOption,
  VenueOption,
} from "../types/offerTypes";

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

export async function fetchOffers(params?: {
  search?: string;
  customerId?: number | null;
  status?: string | null;
  skip?: number;
  limit?: number;
}): Promise<OfferListItem[]> {
  return requestJson<OfferListItem[]>(
    buildUrl("/offers", {
      search: params?.search,
      customer_id: params?.customerId,
      status: params?.status,
      skip: params?.skip,
      limit: params?.limit,
    })
  );
}

export async function createOffer(
  payload: OfferCreatePayload
): Promise<OfferListItem> {
  return requestJson<OfferListItem>("/offers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchOfferDetail(offerId: number): Promise<OfferDetail> {
  return requestJson<OfferDetail>(`/offers/${offerId}/detail`);
}

export async function updateOffer(
  offerId: number,
  payload: OfferUpdatePayload
): Promise<OfferListItem> {
  return requestJson<OfferListItem>(`/offers/${offerId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function importPackageToOffer(
  offerId: number,
  packageId: number,
  clearExistingItems = true
): Promise<OfferDetail> {
  return requestJson<OfferDetail>(`/offers/${offerId}/import-package`, {
    method: "POST",
    body: JSON.stringify({
      package_id: packageId,
      clear_existing_items: clearExistingItems,
    }),
  });
}

export async function createOfferItem(
  offerId: number,
  payload: OfferItemCreatePayload
): Promise<OfferItem> {
  return requestJson<OfferItem>(`/offers/${offerId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteOfferItem(
  offerId: number,
  itemId: number
): Promise<OfferItem> {
  return requestJson<OfferItem>(`/offers/${offerId}/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function convertOfferToAgreement(
  offerId: number,
  agreementNotes: string | null
): Promise<OfferListItem> {
  return requestJson<OfferListItem>(`/offers/${offerId}/convert-to-agreement`, {
    method: "POST",
    body: JSON.stringify({
      agreement_notes: agreementNotes,
    }),
  });
}

export async function fetchOfferPrintView(
  offerId: number
): Promise<OfferPrintView> {
  return requestJson<OfferPrintView>(`/offers/${offerId}/print-view`);
}

export async function fetchCustomers(params?: {
  search?: string;
  isActive?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<CustomerOption[]> {
  return requestJson<CustomerOption[]>(
    buildUrl("/customers", {
      search: params?.search,
      is_active: params?.isActive,
      skip: params?.skip,
      limit: params?.limit,
    })
  );
}

export async function fetchCustomerVenues(customerId: number): Promise<VenueOption[]> {
  return requestJson<VenueOption[]>(`/customers/${customerId}/venues`);
}

export async function fetchPackages(params?: {
  search?: string;
  isActive?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<PackageOption[]> {
  return requestJson<PackageOption[]>(
    buildUrl("/service-catalog/packages", {
      search: params?.search,
      is_active: params?.isActive,
      skip: params?.skip,
      limit: params?.limit,
    })
  );
}
