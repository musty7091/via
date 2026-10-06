import { useQuery } from "@tanstack/react-query";

import { api, type Schema } from "@/shared/api/client";

type Company = Schema<"CompanySettingsRead">;

/** Çıktı başlığındaki şirket bilgisi (Ayarlar ekranıyla aynı önbellek). */
export function useCompany() {
  return useQuery({ queryKey: ["settings", "company"], queryFn: () => api<Company>("/settings/company") });
}
