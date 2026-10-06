import { MapPin, Plus } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/features/auth/auth";
import { PAGE_SIZE, useVenues, type ListFilters, type Venue } from "@/features/customers/api";
import { VenueFormDialog } from "@/features/customers/VenueFormDialog";
import { VENUE_TYPE_LABELS } from "@/shared/lib/labels";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  Toolbar,
  type Column,
} from "@/shared/ui";

type VenueFilters = Omit<ListFilters, "type">;

const columns: Column<Venue>[] = [
  {
    key: "name",
    header: "Mekân",
    cell: (v) => (
      <div>
        <p className="font-medium text-ink">{v.name}</p>
        <p className="text-xs text-ink-muted">{VENUE_TYPE_LABELS[v.venue_type]}</p>
      </div>
    ),
  },
  { key: "city", header: "Şehir", cell: (v) => v.city ?? <span className="text-ink-faint">—</span> },
  {
    key: "capacity",
    header: "Kapasite",
    align: "right",
    cell: (v) => (v.capacity ? `${v.capacity.toLocaleString("tr-TR")} kişi` : <span className="text-ink-faint">—</span>),
  },
  {
    key: "customer",
    header: "Bağlı müşteri",
    hideOnMobile: true,
    cell: (v) => v.customer_name ?? <span className="text-ink-faint">Bağımsız</span>,
  },
];

export function VenuesPage() {
  const can = useCan();
  const canManage = can("customers.manage");
  const [filters, setFilters] = useState<VenueFilters>({ search: "", status: "active", offset: 0 });
  const [form, setForm] = useState<Venue | null | undefined>(undefined);
  const venues = useVenues(filters);

  return (
    <>
      <PageHeader
        eyebrow="Satış"
        title="Mekânlar"
        description="Etkinliklerin yapıldığı yerler ve teknik bilgileri."
        actions={
          canManage && (
            <Button onClick={() => setForm(null)}>
              <Plus /> Yeni Mekân
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters((f) => ({ ...f, search, offset: 0 }))}
            placeholder="Mekân adı veya şehir"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as VenueFilters["status"], offset: 0 }))}
            className="sm:w-36"
            aria-label="Durum"
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </Select>
        </Toolbar>
        {venues.isError ? (
          <ErrorState error={venues.error} />
        ) : (
          <DataTable
            columns={columns}
            rows={venues.data?.items ?? []}
            rowKey={(v) => v.id}
            onRowClick={canManage ? (v) => setForm(v) : undefined}
            empty={venues.isPending ? <LoadingState /> : <EmptyState icon={MapPin} title="Mekân bulunamadı" />}
          />
        )}
        <Pager
          offset={filters.offset}
          limit={PAGE_SIZE}
          total={venues.data?.total ?? 0}
          onChange={(offset) => setFilters((f) => ({ ...f, offset }))}
        />
      </Card>
      <VenueFormDialog open={form !== undefined} onOpenChange={(open) => !open && setForm(undefined)} venue={form} />
    </>
  );
}
