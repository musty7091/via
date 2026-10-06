import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schema } from "@/shared/api/client";

export type ClosurePreview = Schema<"ClosurePreview">;
export type PeriodPreview = Schema<"PeriodPreview">;
export type PeriodRow = Schema<"PeriodRow">;

const C = "/closing";

export function useEventClosure(eventId: number) {
  return useQuery({
    queryKey: ["closing", "event", eventId],
    queryFn: () => api<ClosurePreview>(`${C}/events/${eventId}`),
  });
}

export function usePeriods() {
  return useQuery({ queryKey: ["closing", "periods"], queryFn: () => api<PeriodRow[]>(`${C}/periods`) });
}

export function usePeriod(month: string) {
  return useQuery({
    queryKey: ["closing", "period", month],
    queryFn: () => api<PeriodPreview>(`${C}/periods/${month}`),
    enabled: Boolean(month),
  });
}

/** Kapanış işlemleri finans, etkinlik ve dönem ekranlarının tamamını etkiler. */
function useClosingMutation<TBody, TResult>(fn: (body: TBody) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["closing"] }),
        queryClient.invalidateQueries({ queryKey: ["finance"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
      ]),
  });
}

export const useCloseEvent = (eventId: number) =>
  useClosingMutation((body: { note?: string | null }) =>
    api<ClosurePreview>(`${C}/events/${eventId}/close`, { method: "POST", body }),
  );

export const useReopenEvent = (eventId: number) =>
  useClosingMutation((reason: string) =>
    api<ClosurePreview>(`${C}/events/${eventId}/reopen`, { method: "POST", body: { reason } }),
  );

export const useWriteOff = (eventId: number) =>
  useClosingMutation((reason: string) =>
    api<ClosurePreview>(`${C}/events/${eventId}/write-off`, { method: "POST", body: { reason } }),
  );

export const useClosePeriod = () =>
  useClosingMutation((month: string) => api<PeriodPreview>(`${C}/periods/${month}/close`, { method: "POST" }));

export const useReopenPeriod = () =>
  useClosingMutation(({ month, reason }: { month: string; reason: string }) =>
    api<PeriodPreview>(`${C}/periods/${month}/reopen`, { method: "POST", body: { reason } }),
  );
