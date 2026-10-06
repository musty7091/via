import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useCan } from "@/features/auth/auth";
import { PAGE_SIZE, useEvents, type EventFilters } from "@/features/events/api";
import { eventColumns } from "@/features/events/eventColumns";
import { todayISO } from "@/shared/lib/format";
import { eventStatusOptions } from "@/shared/lib/labels";
import {
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
} from "@/shared/ui";

export function EventsPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EventFilters>({ search: "", status: "", period: "upcoming", offset: 0 });
  const events = useEvents(filters, todayISO());
  const update = (patch: Partial<EventFilters>) => setFilters((f) => ({ ...f, offset: 0, ...patch }));

  return (
    <>
      <PageHeader
        eyebrow="Satış"
        title="Etkinlikler"
        description="Anlaşması yapılmış etkinlik dosyaları. Yeni etkinlik, teklif anlaşmaya çevrilerek açılır."
      />
      <Card>
        <Toolbar>
          <SearchInput
            value={filters.search}
            onChange={(search) => update({ search })}
            placeholder="Etkinlik no, başlık veya müşteri"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select
            value={filters.period}
            onChange={(e) => update({ period: e.target.value as EventFilters["period"] })}
            className="sm:w-40"
            aria-label="Dönem"
          >
            <option value="upcoming">Yaklaşanlar</option>
            <option value="past">Geçmiş</option>
            <option value="all">Tümü</option>
          </Select>
          <Select value={filters.status} onChange={(e) => update({ status: e.target.value })} className="sm:w-40" aria-label="Durum">
            <option value="">Tüm durumlar</option>
            {eventStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Toolbar>
        {events.isError ? (
          <ErrorState error={events.error} />
        ) : (
          <DataTable
            columns={eventColumns(can("finance.view"))}
            rows={events.data?.items ?? []}
            rowKey={(e) => e.id}
            onRowClick={(e) => navigate(`/etkinlikler/${e.id}`)}
            empty={events.isPending ? <LoadingState /> : <EmptyState icon={CalendarDays} title="Etkinlik bulunamadı" />}
          />
        )}
        <Pager
          offset={filters.offset}
          limit={PAGE_SIZE}
          total={events.data?.total ?? 0}
          onChange={(offset) => setFilters((f) => ({ ...f, offset }))}
        />
      </Card>
    </>
  );
}
