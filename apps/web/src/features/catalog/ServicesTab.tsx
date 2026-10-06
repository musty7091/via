import { Speaker } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/features/auth/auth";
import type { Service } from "@/features/catalog/api";
import { CatalogList } from "@/features/catalog/CatalogList";
import { ServiceFormDialog } from "@/features/catalog/ServiceFormDialog";
import { SERVICE_TYPE_LABELS, SERVICE_UNIT_LABELS, serviceTypeOptions } from "@/shared/lib/labels";
import { Money, type Column } from "@/shared/ui";

export function ServicesTab() {
  const can = useCan();
  const canManage = can("catalog.manage");
  const [form, setForm] = useState<Service | null | undefined>(undefined);

  const perUnit = (s: Service) => <span className="text-xs text-ink-muted"> / {SERVICE_UNIT_LABELS[s.unit].toLocaleLowerCase("tr")}</span>;

  const columns: Column<Service>[] = [
    {
      key: "name",
      header: "Hizmet",
      cell: (s) => (
        <div>
          <p className="font-medium text-ink">{s.name}</p>
          <p className="text-xs text-ink-muted">{SERVICE_TYPE_LABELS[s.service_type]}</p>
        </div>
      ),
    },
    ...(can("costs.view")
      ? [
          { key: "supplier", header: "Tedarikçi", cell: (s: Service) => s.supplier_name ?? <span className="text-ink-faint">—</span> },
          {
            key: "cost",
            header: "Maliyet",
            align: "right" as const,
            cell: (s: Service) =>
              s.default_cost ? (
                <span>
                  <Money amount={s.default_cost} currency={s.cost_currency ?? "TRY"} />
                  {perUnit(s)}
                </span>
              ) : (
                <span className="text-ink-faint">—</span>
              ),
          },
        ]
      : []),
    {
      key: "price",
      header: "Satış fiyatı",
      align: "right",
      cell: (s) =>
        s.default_price ? (
          <span>
            <Money amount={s.default_price} currency={s.price_currency} />
            {perUnit(s)}
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <>
      <CatalogList<Service>
        resource="services"
        columns={columns}
        typeOptions={serviceTypeOptions}
        searchPlaceholder="Hizmet adı"
        emptyIcon={Speaker}
        emptyTitle="Hizmet bulunamadı"
        createLabel="Yeni Hizmet"
        onCreate={canManage ? () => setForm(null) : undefined}
        onRowClick={canManage ? (s) => setForm(s) : undefined}
      />
      <ServiceFormDialog open={form !== undefined} onOpenChange={(open) => !open && setForm(undefined)} service={form} />
    </>
  );
}
