import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import { api, ApiError, type Schema } from "@/shared/api/client";

export type Me = Schema<"Me">;

/** Backend'deki Permission listesiyle aynı adlar. */
export type Permission =
  | "users.manage"
  | "settings.manage"
  | "audit.view"
  | "partners.view"
  | "partners.manage"
  | "customers.view"
  | "customers.manage"
  | "catalog.view"
  | "catalog.manage"
  | "offers.view"
  | "offers.manage"
  | "events.view"
  | "events.manage"
  | "operations.view"
  | "operations.manage"
  | "costs.view"
  | "finance.view"
  | "finance.record"
  | "finance.approve"
  | "period.close"
  | "period.reopen"
  | "reports.view";

export const meQueryKey = ["auth", "me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async () => {
      try {
        return await api<Me>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/**
 * RequireAuth, doğruladığı kullanıcıyı bu context ile alt bileşenlere verir.
 * Çıkış anında oturum verisi silinse bile alt bileşenler sayfa kapanana kadar
 * son geçerli kullanıcıyı görür; yarış durumu oluşmaz.
 */
export const CurrentUserContext = createContext<Me | null>(null);

/** Giriş yapmış kullanıcı (sadece RequireAuth altındaki sayfalarda). */
export function useCurrentUser(): Me {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser sadece RequireAuth içinde kullanılabilir.");
  return user;
}

export function useCan() {
  const user = useContext(CurrentUserContext);
  return (permission: Permission) => Boolean(user?.permissions.includes(permission));
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<Me>("/auth/login", { method: "POST", body }),
    onSuccess: (me) => {
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, me);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      api<Me>("/auth/change-password", { method: "POST", body }),
    onSuccess: (me) => queryClient.setQueryData(meQueryKey, me),
  });
}
