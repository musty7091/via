import { Package as PackageIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useCan } from "@/features/auth/auth";
import type { PackageListItem } from "@/features/catalog/api";
import { CatalogList } from "@/features/catalog/CatalogList";
import { PackageFormDialog } from "@/features/catalog/PackageFormDialog";
import { PACKAGE_TYPE_LABELS, packageTypeOptions } from "@/shared/lib/labels";
import { Money, type Column } from "@/shared/ui";

const columns: Column<PackageListItem>[] = [
  {
    key: "name",
    header: "Paket",
    cell: (p) => (
      <div className="min-w-0">
        <p className="font-medium text-ink">{p.name}</p>
        <p className="text-xs text-ink-muted">{PACKAGE_TYPE_LABELS[p.package_type]}</p>
      </div>
    ),
  },
  { key: "items", header: "Kalem", align: "right", cell: (p) => `${p.item_count} kalem` },
  { key: "price", header: "Satış fiyatı", align: "right", cell: (p) => <Money amount={p.price} currency={p.currency} /> },
];

export function PackagesTab() {
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <CatalogList<PackageListItem>
        resource="packages"
        columns={columns}
        typeOptions={packageTypeOptions}
        searchPlaceholder="Paket adı"
        emptyIcon={PackageIcon}
        emptyTitle="Paket bulunamadı"
        createLabel="Yeni Paket"
        onCreate={can("catalog.manage") ? () => setCreating(true) : undefined}
        onRowClick={(p) => navigate(`/katalog/paketler/${p.id}`)}
      />
      <PackageFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(pkg) => navigate(`/katalog/paketler/${pkg.id}`)}
      />
    </>
  );
}
