import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page, type Schema } from "@/shared/api/client";

export type OfferListItem = Schema<"OfferListItem">;
export type Offer = Schema<"OfferDetail">;
export type OfferLine = Schema<"OfferLineRead">;
export type OfferCreate = Schema<"OfferCreate">;
export type OfferUpdate = Schema<"OfferUpdate">;
export type OfferLineCreate = Schema<"OfferLineCreate">;
export type OfferLineUpdate = Schema<"OfferLineUpdate">;
export type OfferPrint = Schema<"OfferPrint">;
export type OfferAction = Schema<"OfferAction">["action"];

export const PAGE_SIZE = 25;

export interface OfferFilters {
  search: string;
  status: string;
  offset: number;
  customerId?: number;
}

export function useOffers(filters: OfferFilters) {
  return useQuery({
    queryKey: ["offers", "list", filters],
    queryFn: () =>
      api<Page<OfferListItem>>("/offers", {
        query: {
          search: filters.search,
          status: filters.status,
          customer_id: filters.customerId,
          offset: filters.offset,
          limit: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useOffer(id: number) {
  return useQuery({ queryKey: ["offers", "detail", id], queryFn: () => api<Offer>(`/offers/${id}`) });
}

export function useOfferPrint(id: number) {
  return useQuery({ queryKey: ["offers", "print", id], queryFn: () => api<OfferPrint>(`/offers/${id}/print`) });
}

/** Teklif değişikliklerinde detay önbelleğini sunucunun döndürdüğü güncel veriyle günceller. */
function useOfferCache() {
  const queryClient = useQueryClient();
  return (offer: Offer) => {
    queryClient.setQueryData(["offers", "detail", offer.id], offer);
    return queryClient.invalidateQueries({ queryKey: ["offers", "list"] });
  };
}

export function useCreateOffer() {
  const update = useOfferCache();
  return useMutation({
    mutationFn: (body: OfferCreate) => api<Offer>("/offers", { method: "POST", body }),
    onSuccess: update,
  });
}

export function useUpdateOffer(id: number) {
  const update = useOfferCache();
  return useMutation({
    mutationFn: (body: OfferUpdate) => api<Offer>(`/offers/${id}`, { method: "PATCH", body }),
    onSuccess: update,
  });
}

export function useOfferAction(id: number) {
  const update = useOfferCache();
  return useMutation({
    mutationFn: (body: { action: OfferAction; note?: string | null }) =>
      api<Offer>(`/offers/${id}/status`, { method: "POST", body }),
    onSuccess: update,
  });
}

export function useDuplicateOffer(id: number) {
  const update = useOfferCache();
  return useMutation({
    mutationFn: () => api<Offer>(`/offers/${id}/duplicate`, { method: "POST" }),
    onSuccess: update,
  });
}

export function useConvertOffer(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { note?: string | null }) =>
      api<{ event_id: number; event_no: string }>(`/offers/${id}/convert`, { method: "POST", body }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["offers"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]),
  });
}

export function useOfferLines(offerId: number) {
  const update = useOfferCache();
  const base = `/offers/${offerId}`;
  return {
    add: useMutation({
      mutationFn: (body: OfferLineCreate) => api<Offer>(`${base}/lines`, { method: "POST", body }),
      onSuccess: update,
    }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: number; body: OfferLineUpdate }) =>
        api<Offer>(`${base}/lines/${id}`, { method: "PATCH", body }),
      onSuccess: update,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api<Offer>(`${base}/lines/${id}`, { method: "DELETE" }),
      onSuccess: update,
    }),
    importPackage: useMutation({
      mutationFn: (body: { package_id: number; price?: string | null; cost_rates?: Record<string, string> }) =>
        api<Offer>(`${base}/packages`, { method: "POST", body }),
      onSuccess: update,
    }),
  };
}
