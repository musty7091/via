import {
  AlertTriangle,
  CalendarCheck,
  Copy,
  FileSignature,
  ListPlus,
  MoreHorizontal,
  Package as PackageIcon,
  Pencil,
  Printer,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  useConvertOffer,
  useDuplicateOffer,
  useOffer,
  useOfferAction,
  useOfferLines,
  type Offer,
  type OfferAction,
  type OfferLine,
} from "@/features/offers/api";
import { LineRow } from "@/features/offers/LineRow";
import { OfferFormDialog } from "@/features/offers/OfferFormDialog";
import { OfferLineDialog } from "@/features/offers/OfferLineDialog";
import { OfferStatusBadge } from "@/features/offers/OfferStatusBadge";
import { PackageImportDialog } from "@/features/offers/PackageImportDialog";
import { errorMessage } from "@/shared/api/client";
import { formatDate, formatMoney, formatNumber } from "@/shared/lib/format";
import { INVOICE_LABELS } from "@/shared/lib/labels";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DescriptionList,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Money,
  PageHeader,
  Textarea,
  toast,
} from "@/shared/ui";

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : null);
const timeRange = (start: string | null, end: string | null) => (start ? `${hhmm(start)} – ${hhmm(end)}` : null);

function LinesCard({ offer, editable }: { offer: Offer; editable: boolean }) {
  const [lineForm, setLineForm] = useState<OfferLine | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<OfferLine | null>(null);
  const { remove } = useOfferLines(offer.id);

  const topLevel = offer.lines.filter((line) => line.parent_id === null);
  const childrenOf = (id: number) => offer.lines.filter((line) => line.parent_id === id);

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("Satır silindi.");
        setDeleting(null);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });
  };

  return (
    <Card>
      <CardHeader
        title="Program ve Fiyatlar"
        description="Müşteriye görünen satırlar teklif çıktısında bu sırayla yer alır."
        actions={
          editable && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
                <PackageIcon /> Paket
              </Button>
              <Button size="sm" onClick={() => setLineForm(null)}>
                <ListPlus /> Satır
              </Button>
            </>
          )
        }
      />
      {topLevel.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="Teklifte henüz satır yok"
          description={editable ? "Hazır bir paket ekleyin veya sanatçı, hizmet, serbest satır girin." : undefined}
        />
      ) : (
        <ul className="divide-y divide-line">
          {topLevel.map((line) => (
            <li key={line.id}>
              <ul>
                <LineRow
                  line={line}
                  currency={offer.currency}
                  editable={editable}
                  onEdit={() => setLineForm(line)}
                  onDelete={() => setDeleting(line)}
                />
                {childrenOf(line.id).map((child) => (
                  <LineRow key={child.id} line={child} currency={offer.currency} nested editable={editable} onEdit={() => setLineForm(child)} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <OfferLineDialog
        offer={offer}
        open={lineForm !== undefined}
        onOpenChange={(open) => !open && setLineForm(undefined)}
        line={lineForm}
      />
      <PackageImportDialog offer={offer} open={importing} onOpenChange={setImporting} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Satır Silinecek"
        description={`"${deleting?.title}" tekliften silinecek.`}
        effects={deleting?.line_type === "package" ? ["Paketin tüm içerik satırları da silinir."] : undefined}
        confirmLabel="Sil"
        tone="danger"
        loading={remove.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

// --- Yan kartlar ---

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? "text-ink" : "text-ink-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function TotalsCard({ offer }: { offer: Offer }) {
  const c = offer.currency;
  const hasDiscount = Number(offer.discount_amount) > 0;
  const hasVat = offer.invoice_type === "with_invoice";
  return (
    <Card>
      <CardHeader title="Tutarlar" description={INVOICE_LABELS[offer.invoice_type]} />
      <CardBody className="space-y-2">
        <Row label="Ara toplam">
          <Money amount={offer.subtotal} currency={c} />
        </Row>
        {hasDiscount && (
          <Row label="İndirim">
            <Money amount={`-${offer.discount_amount}`} currency={c} />
          </Row>
        )}
        {(hasDiscount || hasVat) && (
          <Row label="KDV hariç toplam">
            <Money amount={offer.net_amount} currency={c} />
          </Row>
        )}
        {hasVat && (
          <Row label={`KDV (%${formatNumber(offer.vat_rate)})`}>
            <Money amount={offer.vat_amount} currency={c} />
          </Row>
        )}
        <div className="border-t border-line pt-2">
          <Row label="Genel toplam" strong>
            <Money amount={offer.total_amount} currency={c} />
          </Row>
          {c !== "TRY" && (
            <p className="mt-0.5 text-right text-xs text-ink-muted">
              ≈ <Money amount={offer.base_total_amount} /> (1 {c} = {formatNumber(offer.exchange_rate)} TL)
            </p>
          )}
        </div>
        {Number(offer.advance_amount) > 0 && (
          <div className="space-y-2 border-t border-line pt-2">
            <Row label="Ön ödeme / kapora">
              <Money amount={offer.advance_amount} currency={c} />
            </Row>
            <Row label="Kalan">
              <Money amount={offer.remaining_amount} currency={c} />
            </Row>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ProfitCard({ offer }: { offer: Offer }) {
  const p = offer.profitability;
  if (!p) return null;
  return (
    <Card>
      <CardHeader title="İç Kârlılık (TL)" description="Müşteri görmez. Teklif ve maliyet kurlarıyla tahmin." />
      <CardBody className="space-y-2">
        <Row label="Gelir (KDV hariç)">
          <Money amount={p.revenue_base} />
        </Row>
        <Row label="Maliyet">
          <Money amount={`-${p.cost_base}`} />
        </Row>
        <div className="border-t border-line pt-2">
          <Row label="Tahmini kâr" strong>
            <Money amount={p.profit_base} signed />
          </Row>
          {p.margin_percent !== null && (
            <p className="text-right text-xs text-ink-muted">Kâr marjı %{formatNumber(p.margin_percent)}</p>
          )}
        </div>
        {p.warnings.length > 0 && (
          <ul className="space-y-1 rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
            {p.warnings.map((w) => (
              <li key={w} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function InfoCard({ offer }: { offer: Offer }) {
  return (
    <Card>
      <CardHeader title="Teklif Bilgileri" />
      <CardBody>
        <DescriptionList
          className="sm:grid-cols-1"
          items={[
            {
              label: "Müşteri",
              value: (
                <Link to={`/musteriler/${offer.customer.id}`} className="text-brand-700 hover:underline">
                  {offer.customer.name}
                </Link>
              ),
            },
            { label: "Yetkili", value: offer.contact?.name },
            { label: "Mekân", value: offer.venue?.name },
            { label: "İşi getiren ortak", value: offer.partner.name },
            {
              label: "Etkinlik",
              value: offer.event_date
                ? [formatDate(offer.event_date), timeRange(offer.event_start, offer.event_end), offer.guest_count ? `${offer.guest_count} kişi` : null]
                    .filter(Boolean)
                    .join(" · ")
                : null,
            },
            { label: "Teklif tarihi", value: formatDate(offer.offer_date) },
            { label: "Geçerlilik", value: formatDate(offer.valid_until) },
            { label: "Ödeme şartları", value: offer.payment_terms },
            { label: "Müşteriye not", value: offer.customer_notes },
            { label: "İç not", value: offer.internal_notes },
          ]}
        />
      </CardBody>
    </Card>
  );
}

// --- Durum eylemleri ---

const ACTION_COPY: Record<OfferAction, { title: string; description: string; confirm: string; needsNote?: boolean; danger?: boolean }> = {
  send: { title: "Teklif Gönderildi Olarak İşaretlenecek", description: "Teklif müşteriye iletildi olarak kaydedilir ve düzenlemeye kapanır.", confirm: "Gönderildi İşaretle" },
  accept: { title: "Teklif Kabul Edildi", description: "Müşterinin teklifi kabul ettiği kaydedilir. Ardından anlaşmaya çevirebilirsiniz.", confirm: "Kabul Edildi İşaretle" },
  reject: { title: "Teklif Reddedildi", description: "Müşterinin teklifi reddettiği kaydedilir.", confirm: "Reddedildi İşaretle", needsNote: true, danger: true },
  cancel: { title: "Teklif İptal Edilecek", description: "Teklif iptal listesine taşınır; silinmez.", confirm: "İptal Et", needsNote: true, danger: true },
  reopen: { title: "Teklif Taslağa Alınacak", description: "Teklif yeniden düzenlenebilir hale gelir. Değişiklikten sonra tekrar gönderin.", confirm: "Taslağa Al" },
};

function ActionDialog({ offer, action, onClose }: { offer: Offer; action: OfferAction | null; onClose: () => void }) {
  const mutation = useOfferAction(offer.id);
  const [note, setNote] = useState("");
  const copy = action ? ACTION_COPY[action] : null;
  const close = () => {
    setNote("");
    mutation.reset();
    onClose();
  };
  const submit = () =>
    action &&
    mutation.mutate(
      { action, note: note.trim() || null },
      {
        onSuccess: () => {
          toast.success("Teklif durumu güncellendi.");
          close();
        },
      },
    );

  return (
    <Dialog
      open={action !== null}
      onOpenChange={(open) => !open && close()}
      title={copy?.title ?? ""}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Vazgeç
          </Button>
          <Button variant={copy?.danger ? "danger" : "primary"} onClick={submit} loading={mutation.isPending}>
            {copy?.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{copy?.description}</p>
        {copy?.needsNote && (
          <Field label="Sebep" required>
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        )}
        {mutation.isError && <p className="text-sm text-danger-600">{errorMessage(mutation.error)}</p>}
      </div>
    </Dialog>
  );
}

// --- Sayfa ---

export function OfferDetailPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const offer = useOffer(id);
  const duplicate = useDuplicateOffer(id);
  const convert = useConvertOffer(id);
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<OfferAction | null>(null);
  const [converting, setConverting] = useState(false);

  if (offer.isPending) return <LoadingState />;
  if (offer.isError) return <ErrorState error={offer.error} />;
  const o = offer.data;
  const allowed = new Set(o.allowed_actions);
  const editable = allowed.has("edit");

  const doDuplicate = () =>
    duplicate.mutate(undefined, {
      onSuccess: (copy) => {
        toast.success(`${copy.offer_no} taslağı oluşturuldu.`);
        navigate(`/teklifler/${copy.id}`);
      },
      onError: (error) => toast.error(errorMessage(error)),
    });

  const doConvert = () =>
    convert.mutate(
      {},
      {
        onSuccess: (result) => {
          toast.success(`${result.event_no} etkinlik dosyası açıldı.`);
          navigate(`/etkinlikler/${result.event_id}`);
        },
        onError: (error) => {
          toast.error(errorMessage(error));
          setConverting(false);
        },
      },
    );

  const menuItems: { key: string; label: string; icon: ReactNode; onSelect: () => void; danger?: boolean }[] = [
    ...(allowed.has("reopen") ? [{ key: "reopen", label: "Taslağa al", icon: <RotateCcw />, onSelect: () => setAction("reopen") }] : []),
    ...(allowed.has("reject") ? [{ key: "reject", label: "Reddedildi", icon: <ThumbsDown />, onSelect: () => setAction("reject"), danger: true }] : []),
    ...(allowed.has("duplicate") ? [{ key: "duplicate", label: "Kopyasını oluştur", icon: <Copy />, onSelect: doDuplicate }] : []),
    ...(allowed.has("cancel") ? [{ key: "cancel", label: "İptal et", icon: <XCircle />, onSelect: () => setAction("cancel"), danger: true }] : []),
  ];

  return (
    <>
      <PageHeader
        back={{ to: "/teklifler", label: "Teklifler" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {o.title}
            <OfferStatusBadge status={o.status} expired={o.is_expired} />
          </span>
        }
        description={`${o.offer_no} · ${o.customer.name}`}
        actions={
          <>
            {o.event_id && (
              <Button asChild>
                <Link to={`/etkinlikler/${o.event_id}`}>
                  <CalendarCheck /> Etkinliğe Git
                </Link>
              </Button>
            )}
            {allowed.has("send") && (
              <Button onClick={() => setAction("send")}>
                <Send /> Gönderildi
              </Button>
            )}
            {allowed.has("accept") && (
              <Button variant="secondary" onClick={() => setAction("accept")}>
                <ThumbsUp /> Kabul Edildi
              </Button>
            )}
            {allowed.has("convert") && (
              <Button onClick={() => setConverting(true)}>
                <FileSignature /> Anlaşmaya Çevir
              </Button>
            )}
            {editable && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil /> Düzenle
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link to={`/teklifler/${o.id}/yazdir`} target="_blank">
                <Printer /> Yazdır / PDF
              </Link>
            </Button>
            {menuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon" aria-label="Diğer işlemler">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuItems.map((item) => (
                    <DropdownMenuItem key={item.key} icon={item.icon} tone={item.danger ? "danger" : "default"} onSelect={item.onSelect}>
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {o.status_note && (o.status === "rejected" || o.status === "cancelled") && (
        <div className="mb-6 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <strong className="font-medium">{o.status === "rejected" ? "Ret sebebi" : "İptal sebebi"}:</strong> {o.status_note}
        </div>
      )}
      {!editable && o.status === "sent" && (
        <div className="mb-6 rounded-lg border border-info-50 bg-info-50 px-4 py-3 text-sm text-info-700">
          Teklif müşteriye gönderildi; değişiklik için önce <strong className="font-medium">Taslağa al</strong>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LinesCard offer={o} editable={editable} />
        </div>
        <div className="space-y-6">
          <TotalsCard offer={o} />
          <ProfitCard offer={o} />
          <InfoCard offer={o} />
        </div>
      </div>

      <OfferFormDialog open={editing} onOpenChange={setEditing} offer={o} />
      <ActionDialog offer={o} action={action} onClose={() => setAction(null)} />
      <ConfirmDialog
        open={converting}
        onOpenChange={setConverting}
        title="Teklif Anlaşmaya Çevrilecek"
        description={`${o.offer_no} teklifi için etkinlik dosyası açılacak.`}
        effects={[
          `Anlaşma tutarı ${formatMoney(o.total_amount, o.currency)} olarak dondurulur.`,
          ...(o.currency !== "TRY" ? [`Kur 1 ${o.currency} = ${formatNumber(o.exchange_rate)} TL olarak sabitlenir.`] : []),
          "Teklif bundan sonra değiştirilemez.",
        ]}
        confirmLabel="Anlaşmaya Çevir"
        loading={convert.isPending}
        onConfirm={doConvert}
      />
    </>
  );
}
