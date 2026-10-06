import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schema } from "@/shared/api/client";

export type Partner = Schema<"PartnerRead">;
export type PartnerCreate = Schema<"PartnerCreate">;
export type PartnerUpdate = Schema<"PartnerUpdate">;

export function usePartners(includeInactive: boolean, enabled = true) {
  return useQuery({
    queryKey: ["partners", { includeInactive }],
    queryFn: () => api<Partner[]>("/partners", { query: { include_inactive: includeInactive } }),
    enabled,
  });
}

function useInvalidatePartners() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["partners"] }),
      // Kullanıcı listesindeki "bağlı ortak" bilgisi de değişir.
      queryClient.invalidateQueries({ queryKey: ["users"] }),
    ]);
}

export function useCreatePartner() {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: (body: PartnerCreate) => api<Partner>("/partners", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useUpdatePartner() {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PartnerUpdate }) =>
      api<Partner>(`/partners/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}
