import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page, type Schema } from "@/shared/api/client";

export type EventListItem = Schema<"EventListItem">;
export type EventDetail = Schema<"EventDetail">;
export type EventUpdate = Schema<"EventUpdate">;
export type EventAction = Schema<"EventAction">["action"];

export const PAGE_SIZE = 25;

export interface EventFilters {
  search: string;
  status: string;
  /** upcoming: bugün ve sonrası, past: geçmiş, all: hepsi */
  period: "upcoming" | "past" | "all";
  offset: number;
  customerId?: number;
}

export function useEvents(filters: EventFilters, today: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["events", "list", filters, today],
    queryFn: () =>
      api<Page<EventListItem>>("/events", {
        query: {
          search: filters.search,
          status: filters.status,
          customer_id: filters.customerId,
          date_from: filters.period === "upcoming" ? today : undefined,
          date_to: filters.period === "past" ? today : undefined,
          offset: filters.offset,
          limit: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useEvent(id: number) {
  return useQuery({ queryKey: ["events", "detail", id], queryFn: () => api<EventDetail>(`/events/${id}`) });
}

function useEventCache() {
  const queryClient = useQueryClient();
  return (event: EventDetail) => {
    queryClient.setQueryData(["events", "detail", event.id], event);
    return queryClient.invalidateQueries({ queryKey: ["events", "list"] });
  };
}

export function useUpdateEvent(id: number) {
  const update = useEventCache();
  return useMutation({
    mutationFn: (body: EventUpdate) => api<EventDetail>(`/events/${id}`, { method: "PATCH", body }),
    onSuccess: update,
  });
}

export type EventActionBody = Schema<"EventAction">;

export function useEventAction(id: number) {
  const update = useEventCache();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EventActionBody) => api<EventDetail>(`/events/${id}/status`, { method: "POST", body }),
    onSuccess: async (event) => {
      await update(event);
      // İptal/yeniden açma finans kayıtlarını değiştirir.
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      await queryClient.invalidateQueries({ queryKey: ["closing"] });
    },
  });
}
