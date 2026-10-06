import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  /** İki sütunu kaplasın mı (uzun metinler için) */
  wide?: boolean;
}

/** Kayıt detaylarında "etiket: değer" listesi. Boş değerler tire ile gösterilir. */
export function DescriptionList({ items, className }: { items: DescriptionItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className={cn("min-w-0", item.wide && "sm:col-span-2")}>
          <dt className="text-xs text-ink-muted">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words whitespace-pre-line text-ink">
            {item.value === null || item.value === undefined || item.value === "" ? (
              <span className="text-ink-faint">—</span>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
