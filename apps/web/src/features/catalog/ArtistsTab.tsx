import { Mic2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useCan } from "@/features/auth/auth";
import type { Artist } from "@/features/catalog/api";
import { ArtistFormDialog } from "@/features/catalog/ArtistFormDialog";
import { CatalogList } from "@/features/catalog/CatalogList";
import { ARTIST_TYPE_LABELS, artistTypeOptions } from "@/shared/lib/labels";
import { Money, type Column } from "@/shared/ui";

export function ArtistsTab() {
  const can = useCan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const columns: Column<Artist>[] = [
    {
      key: "name",
      header: "Sanatçı",
      cell: (a) => (
        <div>
          <p className="font-medium text-ink">{a.name}</p>
          <p className="text-xs text-ink-muted">{ARTIST_TYPE_LABELS[a.artist_type]}</p>
        </div>
      ),
    },
    {
      key: "manager",
      header: "Menajer ortak",
      cell: (a) => a.manager_partner_name ?? <span className="text-ink-faint">—</span>,
    },
    ...(can("costs.view")
      ? [
          {
            key: "cost",
            header: "Maliyet",
            align: "right" as const,
            cell: (a: Artist) =>
              a.default_cost ? <Money amount={a.default_cost} currency={a.cost_currency ?? "TRY"} /> : <span className="text-ink-faint">—</span>,
          },
        ]
      : []),
    {
      key: "price",
      header: "Satış fiyatı",
      align: "right",
      cell: (a) =>
        a.default_price ? <Money amount={a.default_price} currency={a.price_currency} /> : <span className="text-ink-faint">—</span>,
    },
  ];

  return (
    <>
      <CatalogList<Artist>
        resource="artists"
        columns={columns}
        typeOptions={artistTypeOptions}
        searchPlaceholder="Sanatçı adı veya telefon"
        emptyIcon={Mic2}
        emptyTitle="Sanatçı bulunamadı"
        createLabel="Yeni Sanatçı"
        onCreate={can("catalog.manage") ? () => setCreating(true) : undefined}
        onRowClick={(a) => navigate(`/katalog/sanatcilar/${a.id}`)}
      />
      <ArtistFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(artist) => navigate(`/katalog/sanatcilar/${artist.id}`)}
      />
    </>
  );
}
