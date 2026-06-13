import { getStoredToken } from "../../../services/authStorage";
import type {
  CustomerContact,
  CustomerContactCreatePayload,
  CustomerCreatePayload,
  CustomerDetail,
  CustomerLedgerMovement,
  CustomerLedgerMovementCreatePayload,
  CustomerLedgerSummary,
  CustomerListItem,
  CustomerUpdatePayload,
  CustomerVenue,
  CustomerVenueCreatePayload,
} from "../types/customerTypes";

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

export async function fetchCustomers(params?: {
  search?: string;
  isActive?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<CustomerListItem[]> {
  const url = new URL(`${API_BASE_URL}/customers`);

  if (params?.search) {
    url.searchParams.set("search", params.search);
  }

  if (params?.isActive !== undefined && params.isActive !== null) {
    url.searchParams.set("is_active", String(params.isActive));
  }

  if (params?.skip !== undefined) {
    url.searchParams.set("skip", String(params.skip));
  }

  if (params?.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function createCustomer(
  payload: CustomerCreatePayload
): Promise<CustomerDetail> {
  const response = await fetch(`${API_BASE_URL}/customers`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function updateCustomer(
  customerId: number,
  payload: CustomerUpdatePayload
): Promise<CustomerDetail> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchCustomer(customerId: number): Promise<CustomerDetail> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchCustomerContacts(
  customerId: number
): Promise<CustomerContact[]> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}/contacts`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function createCustomerContact(
  customerId: number,
  payload: CustomerContactCreatePayload
): Promise<CustomerContact> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}/contacts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchCustomerVenues(
  customerId: number
): Promise<CustomerVenue[]> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}/venues`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function createCustomerVenue(
  customerId: number,
  payload: CustomerVenueCreatePayload
): Promise<CustomerVenue> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}/venues`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchCustomerLedger(
  customerId: number
): Promise<CustomerLedgerMovement[]> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}/ledger`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function createCustomerLedgerMovement(
  customerId: number,
  payload: CustomerLedgerMovementCreatePayload
): Promise<CustomerLedgerMovement> {
  const response = await fetch(`${API_BASE_URL}/customers/${customerId}/ledger`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}

export async function fetchCustomerLedgerSummary(
  customerId: number
): Promise<CustomerLedgerSummary> {
  const response = await fetch(
    `${API_BASE_URL}/customers/${customerId}/ledger/summary`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return response.json();
}