import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schema } from "@/shared/api/client";

export type Rate = Schema<"RateRead">;
export type RateSet = Schema<"RateSet">;

/** Verilen tarihte (yoksa bugün) geçerli kurlar; bugün için TCMB'den otomatik yenilenir. */
export function useRates(on?: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["rates", on ?? "today"],
    queryFn: () => api<Rate[]>("/rates", { query: { on } }),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSetRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RateSet) => api<Rate>("/rates", { method: "PUT", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rates"] }),
  });
}

export function useFetchRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<Rate[]>("/rates/fetch", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rates"] }),
  });
}
