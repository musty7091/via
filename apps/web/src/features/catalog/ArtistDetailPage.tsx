import { ClipboardList, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { useCan } from "@/features/auth/auth";
import { useArtist, type RiderItem } from "@/features/catalog/api";
import { ArtistFormDialog } from "@/features/catalog/ArtistFormDialog";
import { RiderItemDialog } from "@/features/catalog/RiderItemDialog";
import { PayeeLedgerCard } from "@/features/finance/PayeeLedgerCard";
import { ARTIST_TYPE_LABELS, RIDER_CATEGORY_LABELS } from "@/shared/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
} from "@/shared/ui";

export function ArtistDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const canManage = can("catalog.manage");
  const artist = useArtist(id);
  const [editing, setEditing] = useState(false);
  const [riderForm, setRiderForm] = useState<RiderItem | null | undefined>(undefined);

  if (artist.isPending) return <LoadingState />;
  if (artist.isError) return <ErrorState error={artist.error} />;
  const a = artist.data;
  const nextSort = a.rider_items.reduce((max, r) => Math.max(max, r.sort_order), 0) + 10;

  return (
    <>
      <PageHeader
        back={{ to: "/katalog/sanatcilar", label: "Sanatçılar" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {a.name}
            {!a.is_active && <Badge tone="neutral">Pasif</Badge>}
          </span>
        }
        description={ARTIST_TYPE_LABELS[a.artist_type]}
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil /> Düzenle
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Bilgiler" />
          <CardBody>
            <DescriptionList
              className="sm:grid-cols-1"
              items={[
                { label: "Menajer ortak", value: a.manager_partner_name },
                { label: "İletişim kişisi", value: a.contact_name },
                { label: "Telefon", value: a.phone && <a href={`tel:${a.phone}`} className="hover:text-brand-700">{a.phone}</a> },
                { label: "E-posta", value: a.email },
                ...(a.cost_currency
                  ? [
                      { label: "IBAN", value: a.iban && <span className="font-mono text-xs">{a.iban}</span> },
                      { label: "Varsayılan maliyet", value: a.default_cost && <Money amount={a.default_cost} currency={a.cost_currency} /> },
                    ]
                  : []),
                { label: "Varsayılan satış fiyatı", value: a.default_price && <Money amount={a.default_price} currency={a.price_currency} /> },
                { label: "Not", value: a.notes },
              ]}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Rider ve Kulis Şartları"
            description="Her etkinlikte operasyon kontrol listesine otomatik eklenir."
            actions={
              canManage && (
                <Button size="sm" onClick={() => setRiderForm(null)}>
                  <Plus /> Şart Ekle
                </Button>
              )
            }
          />
          {a.rider_items.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Henüz rider şartı yok" />
          ) : (
            <ul className="divide-y divide-line">
              {a.rider_items.map((item) => (
                <li key={item.id} className={`flex items-start gap-3 px-5 py-3.5 ${item.is_active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {item.title}
                      <Badge dot={false}>{RIDER_CATEGORY_LABELS[item.category]}</Badge>
                      {item.is_required ? <Badge tone="warning">Zorunlu</Badge> : <Badge tone="neutral" dot={false}>İsteğe bağlı</Badge>}
                      {!item.is_active && <Badge tone="neutral">Pasif</Badge>}
                    </p>
                    {item.description && <p className="mt-0.5 text-sm text-ink-muted">{item.description}</p>}
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => setRiderForm(item)} aria-label={`${item.title} düzenle`}>
                      <Pencil />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {can("finance.view") && <PayeeLedgerCard kind="artists" id={a.id} />}

      <ArtistFormDialog open={editing} onOpenChange={setEditing} artist={a} />
      <RiderItemDialog
        artistId={a.id}
        open={riderForm !== undefined}
        onOpenChange={(open) => !open && setRiderForm(undefined)}
        item={riderForm}
        nextSortOrder={nextSort}
      />
    </>
  );
}
