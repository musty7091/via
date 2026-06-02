import { getStoredToken } from "../../../services/authStorage";
import type {
  ArtistCreatePayload,
  ArtistService,
  PackageItem,
  PackageItemCreatePayload,
  RiderCreatePayload,
  RiderItem,
  ServicePackage,
  ServicePackageCreatePayload,
  ServicePackageDetail,
  TechnicalService,
  TechnicalServiceCreatePayload,
} from "../types/serviceCatalogTypes";

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
  const response = await fetch(url.toString(), {
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

export async function fetchArtists(params?: {
  search?: string;
  artistType?: string;
  isActive?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<ArtistService[]> {
  return requestJson<ArtistService[]>(
    buildUrl("/service-catalog/artists", {
      search: params?.search,
      artist_type: params?.artistType,
      is_active: params?.isActive,
      skip: params?.skip,
      limit: params?.limit,
    })
  );
}

export async function createArtist(
  payload: ArtistCreatePayload
): Promise<ArtistService> {
  return requestJson<ArtistService>("/service-catalog/artists", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchArtistRiderItems(artistId: number): Promise<RiderItem[]> {
  return requestJson<RiderItem[]>(`/service-catalog/artists/${artistId}/rider`);
}

export async function createArtistRiderItem(
  artistId: number,
  payload: RiderCreatePayload
): Promise<RiderItem> {
  return requestJson<RiderItem>(`/service-catalog/artists/${artistId}/rider`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchTechnicalServices(params?: {
  search?: string;
  serviceType?: string;
  isActive?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<TechnicalService[]> {
  return requestJson<TechnicalService[]>(
    buildUrl("/service-catalog/services", {
      search: params?.search,
      service_type: params?.serviceType,
      is_active: params?.isActive,
      skip: params?.skip,
      limit: params?.limit,
    })
  );
}

export async function createTechnicalService(
  payload: TechnicalServiceCreatePayload
): Promise<TechnicalService> {
  return requestJson<TechnicalService>("/service-catalog/services", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchServicePackages(params?: {
  search?: string;
  packageType?: string;
  isActive?: boolean | null;
  skip?: number;
  limit?: number;
}): Promise<ServicePackage[]> {
  return requestJson<ServicePackage[]>(
    buildUrl("/service-catalog/packages", {
      search: params?.search,
      package_type: params?.packageType,
      is_active: params?.isActive,
      skip: params?.skip,
      limit: params?.limit,
    })
  );
}

export async function createServicePackage(
  payload: ServicePackageCreatePayload
): Promise<ServicePackage> {
  return requestJson<ServicePackage>("/service-catalog/packages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchServicePackageDetail(
  packageId: number
): Promise<ServicePackageDetail> {
  return requestJson<ServicePackageDetail>(
    `/service-catalog/packages/${packageId}/detail`
  );
}

export async function createPackageItem(
  packageId: number,
  payload: PackageItemCreatePayload
): Promise<PackageItem> {
  return requestJson<PackageItem>(`/service-catalog/packages/${packageId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
