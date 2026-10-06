import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, type Schema } from "@/shared/api/client";

export type EventReport = Schema<"EventReport">;
export type EventReportRow = Schema<"EventReportRow">;
export type MonthlyReport = Schema<"MonthlyReport">;
export type MonthRow = Schema<"MonthRow">;
export type ArtistRow = Schema<"ArtistRow">;
export type CustomerRow = Schema<"CustomerRow">;

export interface DateRange {
  date_from: string;
  date_to: string;
}

const R = "/reports";

export function useEventReport(range: DateRange, partnerId?: number) {
  return useQuery({
    queryKey: ["reports", "events", range, partnerId],
    queryFn: () => api<EventReport>(`${R}/events`, { query: { ...range, partner_id: partnerId } }),
    placeholderData: keepPreviousData,
  });
}

export function useMonthlyReport(first?: string, last?: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["reports", "monthly", first, last],
    queryFn: () => api<MonthlyReport>(`${R}/monthly`, { query: { first, last } }),
    placeholderData: keepPreviousData,
  });
}

export function useArtistReport(range: DateRange) {
  return useQuery({
    queryKey: ["reports", "artists", range],
    queryFn: () => api<ArtistRow[]>(`${R}/artists`, { query: { ...range } }),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerReport(range: DateRange) {
  return useQuery({
    queryKey: ["reports", "customers", range],
    queryFn: () => api<CustomerRow[]>(`${R}/customers`, { query: { ...range } }),
    placeholderData: keepPreviousData,
  });
}

export function usePeriodSummary(month: string | undefined) {
  return useQuery({
    enabled: Boolean(month),
    queryKey: ["reports", "period-summary", month],
    queryFn: () => api<Schema<"PeriodSummary">>(`${R}/period-summary`, { query: { month } }),
    placeholderData: keepPreviousData,
  });
}
