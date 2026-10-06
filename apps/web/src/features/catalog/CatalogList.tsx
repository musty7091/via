import { Plus, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { PAGE_SIZE, useCatalogList, type CatalogFilters, type CatalogResource } from "@/features/catalog/api";
import type { Option } from "@/shared/lib/labels";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Pager,
  SearchInput,
  Select,
  Toolbar,
  type Column,
} from "@/shared/ui";

interface Props<T> {
  resource: CatalogResource;
  columns: Column<T>[];
  typeOptions?: Option[];
  searchPlaceholder: string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  createLabel: string;
  onCreate?: () => void;
  onRowClick?: (row: T) => void;
}

/** Katalog sekmelerinin ortak listesi: arama, tür ve durum filtresi, sayfalama. */
export function CatalogList<T extends { id: number }>({
  resource,
  columns,
  typeOptions,
  searchPlaceholder,
  emptyIcon,
  emptyTitle,
  createLabel,
  onCreate,
  onRowClick,
}: Props<T>) {
  const [filters, setFilters] = useState<CatalogFilters>({ search: "", type: "", status: "active", offset: 0 });
  const list = useCatalogList<T>(resource, filters);
  const update = (patch: Partial<CatalogFilters>) => setFilters((f) => ({ ...f, offset: 0, ...patch }));

  return (
    <Card>
      <Toolbar>
        <SearchInput
          value={filters.search}
          onChange={(search) => update({ search })}
          placeholder={searchPlaceholder}
          className="sm:max-w-xs sm:flex-1"
        />
        {typeOptions && (
          <Select value={filters.type} onChange={(e) => update({ type: e.target.value })} className="sm:w-48" aria-label="Tür">
            <option value="">Tüm türler</option>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        <Select
          value={filters.status}
          onChange={(e) => update({ status: e.target.value as CatalogFilters["status"] })}
          className="sm:w-32"
          aria-label="Durum"
        >
          <option value="active">Aktif</option>
          <option value="inactive">Pasif</option>
        </Select>
        {onCreate && (
          <Button onClick={onCreate} className="sm:ml-auto">
            <Plus /> {createLabel}
          </Button>
        )}
      </Toolbar>
      {list.isError ? (
        <ErrorState error={list.error} />
      ) : (
        <DataTable
          columns={columns}
          rows={list.data?.items ?? []}
          rowKey={(row) => row.id}
          onRowClick={onRowClick}
          empty={list.isPending ? <LoadingState /> : <EmptyState icon={emptyIcon} title={emptyTitle} />}
        />
      )}
      <Pager
        offset={filters.offset}
        limit={PAGE_SIZE}
        total={list.data?.total ?? 0}
        onChange={(offset) => setFilters((f) => ({ ...f, offset }))}
      />
    </Card>
  );
}
