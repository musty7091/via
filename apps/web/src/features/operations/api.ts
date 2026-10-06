import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Schema } from "@/shared/api/client";

export type EventOperations = Schema<"EventOperations">;
export type Task = Schema<"TaskRead">;
export type TaskCreate = Schema<"TaskCreate">;
export type TaskUpdate = Schema<"TaskUpdate">;
export type RiderCheck = Schema<"RiderCheckRead">;
export type RiderStatus = RiderCheck["status"];
export type ReportSave = Schema<"ReportSave">;
export type Progress = Schema<"Progress">;
export type BoardItem = Schema<"BoardItem">;
export type MyTask = Schema<"MyTask">;

const O = "/operations";

export function useEventOperations(eventId: number) {
  return useQuery({
    queryKey: ["operations", "event", eventId],
    queryFn: () => api<EventOperations>(`${O}/events/${eventId}`),
  });
}

export function useBoard(days: number) {
  return useQuery({ queryKey: ["operations", "board", days], queryFn: () => api<BoardItem[]>(`${O}/board`, { query: { days } }) });
}

export function useMyTasks(enabled = true) {
  return useQuery({ enabled, queryKey: ["operations", "my-tasks"], queryFn: () => api<MyTask[]>(`${O}/my-tasks`) });
}

/** Her işlem etkinliğin güncel operasyon görünümünü döner; pano ve kapanış kontrolleri de yenilenir. */
function useOperationsMutation<TBody>(eventId: number, fn: (body: TBody) => Promise<EventOperations>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(["operations", "event", eventId], data);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operations", "board"] }),
        queryClient.invalidateQueries({ queryKey: ["operations", "my-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["closing", "event", eventId] }),
      ]);
    },
  });
}

export const useCreateTask = (eventId: number) =>
  useOperationsMutation(eventId, (body: TaskCreate) => api<EventOperations>(`${O}/events/${eventId}/tasks`, { method: "POST", body }));

export const useUpdateTask = (eventId: number) =>
  useOperationsMutation(eventId, ({ id, body }: { id: number; body: TaskUpdate }) =>
    api<EventOperations>(`${O}/tasks/${id}`, { method: "PATCH", body }),
  );

export const useDeleteTask = (eventId: number) =>
  useOperationsMutation(eventId, (id: number) => api<EventOperations>(`${O}/tasks/${id}`, { method: "DELETE" }));

export const useUpdateRiderCheck = (eventId: number) =>
  useOperationsMutation(eventId, ({ id, status, note }: { id: number; status: RiderStatus; note?: string | null }) =>
    api<EventOperations>(`${O}/rider-checks/${id}`, { method: "PATCH", body: { status, note } }),
  );

export const useCreateRiderCheck = (eventId: number) =>
  useOperationsMutation(eventId, (body: Schema<"RiderCheckCreate">) =>
    api<EventOperations>(`${O}/events/${eventId}/rider-checks`, { method: "POST", body }),
  );

export const useSyncRiders = (eventId: number) =>
  useOperationsMutation(eventId, () => api<EventOperations>(`${O}/events/${eventId}/rider-checks/sync`, { method: "POST" }));

export const useSaveReport = (eventId: number) =>
  useOperationsMutation(eventId, (body: ReportSave) => api<EventOperations>(`${O}/events/${eventId}/report`, { method: "PUT", body }));
