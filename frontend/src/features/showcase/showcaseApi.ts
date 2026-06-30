import { getStoredToken } from "../../services/authStorage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? `${window.location.origin}/api/v1`;

export type ShowcaseArtist = {
  id: number;
  category: string;
  name: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  video_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export type ShowcaseCategory = {
  key: string;
  label: string;
  count: number;
};

export type ShowcaseArtistInput = {
  category: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

async function parseApiError(response: Response) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") return data.detail;
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

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ----------------------------- HALKA AÇIK ----------------------------------
export async function fetchPublicCategories(): Promise<ShowcaseCategory[]> {
  const res = await fetch(`${API_BASE_URL}/public/showcase/categories`);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function fetchPublicArtists(
  category?: string
): Promise<ShowcaseArtist[]> {
  const url = new URL(`${API_BASE_URL}/public/showcase/artists`);
  if (category) url.searchParams.set("category", category);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function fetchPublicArtist(id: number): Promise<ShowcaseArtist> {
  const res = await fetch(`${API_BASE_URL}/public/showcase/artists/${id}`);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

// ----------------------------- YÖNETİM -------------------------------------
export async function fetchAdminCategories(): Promise<ShowcaseCategory[]> {
  const res = await fetch(`${API_BASE_URL}/showcase/categories`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function fetchAdminArtists(): Promise<ShowcaseArtist[]> {
  const res = await fetch(`${API_BASE_URL}/showcase/artists`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function createArtist(
  payload: ShowcaseArtistInput
): Promise<ShowcaseArtist> {
  const res = await fetch(`${API_BASE_URL}/showcase/artists`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function updateArtist(
  id: number,
  payload: Partial<ShowcaseArtistInput>
): Promise<ShowcaseArtist> {
  const res = await fetch(`${API_BASE_URL}/showcase/artists/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function deleteArtist(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/showcase/artists/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseApiError(res));
}
