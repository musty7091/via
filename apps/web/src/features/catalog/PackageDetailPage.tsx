import { AlertTriangle, EyeOff, ListMusic, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { useCan } from "@/features/auth/auth";
import { usePackage, usePackageItemMutations, type PackageItem } from "@/features/catalog/api";
import { PackageFormDialog } from "@/features/catalog/PackageFormDialog";
import { PackageItemDialog } from "@/features/catalog/PackageItemDialog";
import { errorMessage } from "@/shared/api/client";
import { COMPONENT_TYPE_LABELS, PACKAGE_TYPE_LABELS, PROGRAM_SECTION_LABELS } from "@/shared/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Money,
  PageHeader,
  toast,
} from "@/shared/ui";

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);

function ProgramRow({
  item,
  canManage,
  onEdit,
  onDelete,
}: {
  item: PackageItem;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const start = hhmm(item.start_time);
  const end = hhmm(item.end_time);
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      {/* Mobilde alt alta (saat, başlık, maliyet), masaüstünde tek satır */}
      <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-4">
        <div className="text-sm tabular text-ink-soft sm:w-24 sm:shrink-0 sm:pt-0.5">
          {start ? (
            <>
              {start}
              <span className="text-ink-faint"> – {end}</span>
            </>
          ) : (
            <span className="text-ink-faint">Saat yok</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            {item.title}
            {Number(item.quantity) !== 1 && (
              <span className="font-normal text-ink-muted">× {Number(item.quantity).toLocaleString("tr-TR")}</span>
            )}
            {!item.is_visible_on_offer && (
              <Badge tone="neutral" dot={false}>
                <EyeOff className="size-3" aria-hidden /> Teklifte gizli
              </Badge>
            )}
            {!item.source_is_active && <Badge tone="warning">Kaynak pasif</Badge>}
          </p>
          <p className="text-xs text-ink-muted">
            {PROGRAM_SECTION_LABELS[item.program_section]} · {COMPONENT_TYPE_LABELS[item.component_type]}
          </p>
        </div>
        {item.total_cost !== null && item.cost_currency && (
          <div className="mt-1.5 flex items-baseline gap-1.5 text-sm sm:mt-0 sm:block sm:shrink-0 sm:text-right">
            <Money amount={item.total_cost} currency={item.cost_currency} />
            <p className="text-xs text-ink-muted">maliyet</p>
          </div>
        )}
      </div>
      {canManage && (
        <div className="-mr-2 flex shrink-0 flex-col sm:mr-0 sm:flex-row sm:gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`${item.title} düzenle`}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`${item.title} çıkar`}>
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );
}

export function PackageDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const canManage = can("catalog.manage");
  const pkg = usePackage(id);
  const { remove } = usePackageItemMutations(id);
  const [editing, setEditing] = useState(false);
  const [itemForm, setItemForm] = useState<PackageItem | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<PackageItem | null>(null);

  if (pkg.isPending) return <LoadingState />;
  if (pkg.isError) return <ErrorState error={pkg.error} />;
  const p = pkg.data;
  const summary = p.summary;

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Kalem paketten çıkarıldı.");
        setDeleting(null);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  return (
    <>
      <PageHeader
        back={{ to: "/katalog/paketler", label: "Paketler" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.name}
            {!p.is_active && <Badge tone="neutral">Pasif</Badge>}
          </span>
        }
        description={PACKAGE_TYPE_LABELS[p.package_type]}
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil /> Düzenle
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Program Akışı"
              description="Teklifte müşteriye fiyatsız olarak bu sırayla görünür."
              actions={
                canManage && (
                  <Button size="sm" onClick={() => setItemForm(null)}>
                    <Plus /> Kalem Ekle
                  </Button>
                )
              }
            />
            {p.items.length === 0 ? (
              <EmptyState icon={ListMusic} title="Pakette henüz kalem yok" description="Sanatçı, hizmet veya serbest kalem ekleyin." />
            ) : (
              <ul className="divide-y divide-line">
                {p.items.map((item) => (
                  <ProgramRow
                    key={item.id}
                    item={item}
                    canManage={canManage}
                    onEdit={() => setItemForm(item)}
                    onDelete={() => setDeleting(item)}
                  />
                ))}
              </ul>
            )}
          </Card>
          {p.description && (
            <Card>
              <CardHeader title="Müşteriye Görünen Açıklama" />
              <CardBody className="text-sm whitespace-pre-line text-ink-soft">{p.description}</CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Satış Fiyatı" />
            <CardBody>
              <p className="text-3xl font-semibold tracking-tight">
                <Money amount={p.price} currency={p.currency} />
              </p>
              <p className="mt-1 text-xs text-ink-muted">Müşteriye tek fiyat olarak sunulur.</p>
            </CardBody>
          </Card>

          {summary && (
            <Card>
              <CardHeader title="İç Kârlılık" description="Müşteri görmez." />
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs text-ink-muted">Toplam maliyet</p>
                  {summary.costs.length === 0 ? (
                    <p className="text-sm text-ink-faint">Maliyet girilmemiş</p>
                  ) : (
                    summary.costs.map((cost) => (
                      <p key={cost.currency} className="text-lg">
                        <Money amount={cost.amount} currency={cost.currency} />
                      </p>
                    ))
                  )}
                </div>
                {summary.needs_exchange_rate ? (
                  <p className="flex gap-2 rounded-md bg-warning-50 px-3 py-2.5 text-sm text-warning-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    Maliyetlerin bir kısmı farklı para biriminde. Kâr, teklifte işlem kuru girildiğinde hesaplanır.
                  </p>
                ) : (
                  summary.gross_profit !== null && (
                    <div className="border-t border-line pt-4">
                      <p className="text-xs text-ink-muted">Brüt kâr</p>
                      <p className="text-2xl font-semibold">
                        <Money amount={summary.gross_profit} currency={p.currency} signed />
                      </p>
                      {summary.margin_percent !== null && (
                        <p className="text-sm text-ink-muted">Kâr marjı %{Number(summary.margin_percent).toLocaleString("tr-TR")}</p>
                      )}
                    </div>
                  )
                )}
              </CardBody>
            </Card>
          )}

          {p.internal_notes && (
            <Card>
              <CardHeader title="İç Not" />
              <CardBody className="text-sm whitespace-pre-line text-ink-soft">{p.internal_notes}</CardBody>
            </Card>
          )}
        </div>
      </div>

      <PackageFormDialog open={editing} onOpenChange={setEditing} pkg={p} />
      <PackageItemDialog
        packageId={p.id}
        open={itemForm !== undefined}
        onOpenChange={(open) => !open && setItemForm(undefined)}
        item={itemForm}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Kalem Paketten Çıkarılacak"
        description={`"${deleting?.title}" bu paketten çıkarılacak.`}
        effects={["Daha önce bu paketle hazırlanmış teklifler etkilenmez.", "İşlem geçmişine kaydedilir."]}
        confirmLabel="Paketten Çıkar"
        tone="danger"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}
