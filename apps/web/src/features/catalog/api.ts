import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page, type Schema } from "@/shared/api/client";

export type Supplier = Schema<"SupplierRead">;
export type SupplierCreate = Schema<"SupplierCreate">;
export type SupplierUpdate = Schema<"SupplierUpdate">;
export type Artist = Schema<"ArtistRead">;
export type ArtistDetail = Schema<"ArtistDetail">;
export type ArtistCreate = Schema<"ArtistCreate">;
export type ArtistUpdate = Schema<"ArtistUpdate">;
export type RiderItem = Schema<"RiderItemRead">;
export type RiderItemCreate = Schema<"RiderItemCreate">;
export type RiderItemUpdate = Schema<"RiderItemUpdate">;
export type Service = Schema<"ServiceRead">;
export type ServiceCreate = Schema<"ServiceCreate">;
export type ServiceUpdate = Schema<"ServiceUpdate">;
export type PackageListItem = Schema<"PackageListItem">;
export type PackageDetail = Schema<"PackageDetail">;
export type PackageCreate = Schema<"PackageCreate">;
export type PackageUpdate = Schema<"PackageUpdate">;
export type PackageItem = Schema<"PackageItemRead">;
export type PackageItemCreate = Schema<"PackageItemCreate">;
export type PackageItemUpdate = Schema<"PackageItemUpdate">;

export const PAGE_SIZE = 25;

export type CatalogResource = "artists" | "services" | "packages" | "suppliers";

export interface CatalogFilters {
  search: string;
  type: string;
  status: "active" | "inactive";
  offset: number;
}

const TYPE_PARAM: Record<CatalogResource, string | null> = {
  artists: "artist_type",
  services: "service_type",
  packages: "package_type",
  suppliers: null,
};

export function useCatalogList<T>(resource: CatalogResource, filters: CatalogFilters) {
  const typeParam = TYPE_PARAM[resource];
  return useQuery({
    queryKey: ["catalog", resource, "list", filters],
    queryFn: () =>
      api<Page<T>>(`/catalog/${resource}`, {
        query: {
          search: filters.search,
          is_active: filters.status === "active",
          offset: filters.offset,
          limit: PAGE_SIZE,
          ...(typeParam ? { [typeParam]: filters.type } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  });
}

/** Seçim kutuları için aktif kayıtlar. */
export function useCatalogOptions<T>(resource: CatalogResource, enabled = true) {
  return useQuery({
    queryKey: ["catalog", resource, "options"],
    queryFn: () => api<Page<T>>(`/catalog/${resource}`, { query: { limit: 200 } }),
    select: (page) => page.items,
    enabled,
  });
}

export function useArtist(id: number) {
  return useQuery({ queryKey: ["catalog", "artists", "detail", id], queryFn: () => api<ArtistDetail>(`/catalog/artists/${id}`) });
}

export function useSupplier(id: number) {
  return useQuery({ queryKey: ["catalog", "suppliers", "detail", id], queryFn: () => api<Supplier>(`/catalog/suppliers/${id}`) });
}

export function usePackage(id: number) {
  return useQuery({
    queryKey: ["catalog", "packages", "detail", id],
    queryFn: () => api<PackageDetail>(`/catalog/packages/${id}`),
    enabled: id > 0,
  });
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["catalog"] });
}

/** Tek bir kaydı oluşturur veya günceller (id verilirse PATCH). */
export function useSaveCatalog<Body, Result>(resource: CatalogResource) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: Body }) =>
      id
        ? api<Result>(`/catalog/${resource}/${id}`, { method: "PATCH", body })
        : api<Result>(`/catalog/${resource}`, { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useSaveRiderItem(artistId: number) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: RiderItemCreate | RiderItemUpdate }) =>
      id
        ? api<RiderItem>(`/catalog/artists/${artistId}/rider-items/${id}`, { method: "PATCH", body })
        : api<RiderItem>(`/catalog/artists/${artistId}/rider-items`, { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function usePackageItemMutations(packageId: number) {
  const queryClient = useQueryClient();
  const setDetail = (detail: PackageDetail) => {
    queryClient.setQueryData(["catalog", "packages", "detail", packageId], detail);
    return queryClient.invalidateQueries({ queryKey: ["catalog", "packages", "list"] });
  };
  const base = `/catalog/packages/${packageId}/items`;
  return {
    save: useMutation({
      mutationFn: ({ id, body }: { id?: number; body: PackageItemCreate | PackageItemUpdate }) =>
        id
          ? api<PackageDetail>(`${base}/${id}`, { method: "PATCH", body })
          : api<PackageDetail>(base, { method: "POST", body }),
      onSuccess: setDetail,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api<PackageDetail>(`${base}/${id}`, { method: "DELETE" }),
      onSuccess: setDetail,
    }),
  };
}
