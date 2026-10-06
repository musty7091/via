import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useCan } from "@/features/auth/auth";
import { PAGE_SIZE, useOffers, type OfferFilters } from "@/features/offers/api";
import { offerColumns } from "@/features/offers/offerColumns";
import { OfferFormDialog } from "@/features/offers/OfferFormDialog";
import { offerStatusOptions } from "@/shared/lib/labels";
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
} from "@/shared/ui";

export function OffersPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<OfferFilters>({ search: "", status: "", offset: 0 });
  const [creating, setCreating] = useState(false);
  const offers = useOffers(filters);
  const update = (patch: Partial<OfferFilters>) => setFilters((f) => ({ ...f, offset: 0, ...patch }));

  return (
    <>
      <PageHeader
        eyebrow="Satış"
        title="Teklifler"
        description="Müşterilere verilen teklifler. Kabul edilen teklif anlaşmaya çevrilince etkinlik dosyası açılır."
        actions={
          can("offers.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Yeni Teklif
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput
            value={filters.search}
            onChange={(search) => update({ search })}
            placeholder="Teklif no, başlık veya müşteri"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select value={filters.status} onChange={(e) => update({ status: e.target.value })} className="sm:w-48" aria-label="Durum">
            <option value="">İptal hariç tümü</option>
            {offerStatusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Toolbar>
        {offers.isError ? (
          <ErrorState error={offers.error} />
        ) : (
          <DataTable
            columns={offerColumns}
            rows={offers.data?.items ?? []}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`/teklifler/${o.id}`)}
            empty={offers.isPending ? <LoadingState /> : <EmptyState icon={FileText} title="Teklif bulunamadı" />}
          />
        )}
        <Pager
          offset={filters.offset}
          limit={PAGE_SIZE}
          total={offers.data?.total ?? 0}
          onChange={(offset) => setFilters((f) => ({ ...f, offset }))}
        />
      </Card>
      <OfferFormDialog open={creating} onOpenChange={setCreating} onSaved={(offer) => navigate(`/teklifler/${offer.id}`)} />
    </>
  );
}
