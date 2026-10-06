import { CalendarDays, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useCan } from "@/features/auth/auth";
import { useEvents } from "@/features/events/api";
import { eventColumns } from "@/features/events/eventColumns";
import { useOffers } from "@/features/offers/api";
import { offerColumns } from "@/features/offers/offerColumns";
import { OfferFormDialog } from "@/features/offers/OfferFormDialog";
import { todayISO } from "@/shared/lib/format";
import { Button, Card, CardHeader, DataTable, EmptyState, LoadingState } from "@/shared/ui";

/** Müşteri detayındaki teklif ve etkinlik listesi. */
export function CustomerSalesTab({ customerId }: { customerId: number }) {
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const offers = useOffers({ search: "", status: "", offset: 0, customerId });
  const events = useEvents({ search: "", status: "", period: "all", offset: 0, customerId }, todayISO());

  return (
    <div className="space-y-6">
      {can("offers.view") && (
        <Card>
          <CardHeader
            title="Teklifler"
            actions={
              can("offers.manage") && (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus /> Yeni Teklif
                </Button>
              )
            }
          />
          <DataTable
            columns={offerColumns}
            rows={offers.data?.items ?? []}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`/teklifler/${o.id}`)}
            empty={offers.isPending ? <LoadingState /> : <EmptyState icon={FileText} title="Bu müşteriye henüz teklif verilmedi" />}
          />
        </Card>
      )}
      <Card>
        <CardHeader title="Etkinlikler" />
        <DataTable
          columns={eventColumns(can("finance.view"))}
          rows={events.data?.items ?? []}
          rowKey={(e) => e.id}
          onRowClick={(e) => navigate(`/etkinlikler/${e.id}`)}
          empty={events.isPending ? <LoadingState /> : <EmptyState icon={CalendarDays} title="Bu müşteriyle henüz etkinlik yok" />}
        />
      </Card>
      <OfferFormDialog
        open={creating}
        onOpenChange={setCreating}
        initialCustomerId={customerId}
        onSaved={(offer) => navigate(`/teklifler/${offer.id}`)}
      />
    </div>
  );
}
