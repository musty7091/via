import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type Page, type Schema } from "@/shared/api/client";

export type User = Schema<"UserRead">;
export type UserCreate = Schema<"UserCreate">;
export type UserUpdate = Schema<"UserUpdate">;
export type RoleOption = Schema<"RoleOption">;
export type Role = User["role"];

export interface UserFilters {
  search: string;
  status: "all" | "active" | "inactive";
  offset: number;
}

export const PAGE_SIZE = 25;

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () =>
      api<Page<User>>("/users", {
        query: {
          search: filters.search,
          is_active: filters.status === "all" ? undefined : filters.status === "active",
          offset: filters.offset,
          limit: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

/** Ortak bağlama gibi seçim listeleri için tüm aktif kullanıcılar. */
export function useUserOptions(enabled = true) {
  return useQuery({
    queryKey: ["users", "options"],
    queryFn: () => api<Page<User>>("/users", { query: { is_active: true, limit: 100 } }),
    select: (page) => page.items,
    enabled,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ["users", "roles"],
    queryFn: () => api<RoleOption[]>("/users/roles"),
    staleTime: Infinity,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: UserCreate) => api<User>("/users", { method: "POST", body }),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UserUpdate }) =>
      api<User>(`/users/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: number; new_password: string }) =>
      api<void>(`/users/${id}/reset-password`, { method: "POST", body: { new_password } }),
  });
}
