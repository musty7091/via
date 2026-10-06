import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page, type Schema } from "@/shared/api/client";

export type CustomerListItem = Schema<"CustomerListItem">;
export type Customer = Schema<"CustomerRead">;
export type CustomerCreate = Schema<"CustomerCreate">;
export type CustomerUpdate = Schema<"CustomerUpdate">;
export type Contact = Schema<"ContactRead">;
export type ContactCreate = Schema<"ContactCreate">;
export type ContactUpdate = Schema<"ContactUpdate">;
export type Venue = Schema<"VenueRead">;
export type VenueCreate = Schema<"VenueCreate">;
export type VenueUpdate = Schema<"VenueUpdate">;

export const PAGE_SIZE = 25;

export interface ListFilters {
  search: string;
  type: string;
  status: "active" | "inactive";
  offset: number;
}

export function useCustomers(filters: ListFilters) {
  return useQuery({
    queryKey: ["customers", "list", filters],
    queryFn: () =>
      api<Page<CustomerListItem>>("/customers", {
        query: {
          search: filters.search,
          customer_type: filters.type,
          is_active: filters.status === "active",
          offset: filters.offset,
          limit: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

/** Seçim kutuları için aktif müşteriler (aramalı). */
export function useCustomerOptions(search = "") {
  return useQuery({
    queryKey: ["customers", "options", search],
    queryFn: () => api<Page<CustomerListItem>>("/customers", { query: { search, limit: 50 } }),
    select: (page) => page.items,
  });
}

export function useCustomer(id: number) {
  return useQuery({
    queryKey: ["customers", "detail", id],
    queryFn: () => api<Customer>(`/customers/${id}`),
    enabled: id > 0,
  });
}

export function useVenues(filters: Omit<ListFilters, "type">) {
  return useQuery({
    queryKey: ["venues", "list", filters],
    queryFn: () =>
      api<Page<Venue>>("/venues", {
        query: {
          search: filters.search,
          is_active: filters.status === "active",
          offset: filters.offset,
          limit: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["venues"] }),
    ]);
}

export function useSaveCustomer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: CustomerCreate | CustomerUpdate }) =>
      id
        ? api<Customer>(`/customers/${id}`, { method: "PATCH", body })
        : api<Customer>("/customers", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useSaveContact(customerId: number) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ContactCreate | ContactUpdate }) =>
      id
        ? api<Contact>(`/customers/${customerId}/contacts/${id}`, { method: "PATCH", body })
        : api<Contact>(`/customers/${customerId}/contacts`, { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useSaveVenue() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: VenueCreate | VenueUpdate }) =>
      id
        ? api<Venue>(`/venues/${id}`, { method: "PATCH", body })
        : api<Venue>("/venues", { method: "POST", body }),
    onSuccess: invalidate,
  });
}
