import { CheckCircle2, FileText, Pencil, RotateCcw, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { useCan } from "@/features/auth/auth";
import { useEvent, useEventAction, type EventAction, type EventDetail } from "@/features/events/api";
import { EventEditDialog } from "@/features/events/EventEditDialog";
import { EventClosureTab } from "@/features/closing/EventClosureTab";
import { EventFinanceTab } from "@/features/finance/EventFinanceTab";
import { LineRow } from "@/features/offers/LineRow";
import { OperationsTab } from "@/features/operations/OperationsTab";
import { EventStatusBadge } from "@/features/offers/OfferStatusBadge";
import { errorMessage } from "@/shared/api/client";
import { formatDate, formatDateTime, formatNumber } from "@/shared/lib/format";
import { INVOICE_LABELS } from "@/shared/lib/labels";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  Dialog,
  ErrorState,
  Field,
  LoadingState,
  Money,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@/shared/ui";

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : null);

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? "text-ink" : "text-ink-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

const ACTION_COPY: Record<EventAction, { title: string; description: string; confirm: string; danger?: boolean; needsNote?: boolean }> = {
  complete: { title: "Etkinlik Gerçekleşti", description: "Etkinliğin yapıldığı kaydedilir. Finans kapanışı bu adımdan sonra yapılır.", confirm: "Gerçekleşti İşaretle" },
  cancel: { title: "Etkinlik İptal Edilecek", description: "Etkinlik iptal edilir. Finans aşamasında kapora iadesi ayrıca işlenir.", confirm: "Etkinliği İptal Et", danger: true, needsNote: true },
  reopen: { title: "Etkinlik Yeniden Açılacak", description: "Etkinlik tekrar 'Planlandı' durumuna alınır.", confirm: "Yeniden Aç" },
};

function ActionDialog({ event, action, onClose }: { event: EventDetail; action: EventAction | null; onClose: () => void }) {
  const mutation = useEventAction(event.id);
  const [note, setNote] = useState("");
  const copy = action ? ACTION_COPY[action] : null;
  const close = () => {
    setNote("");
    mutation.reset();
    onClose();
  };
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
          <Button
            variant={copy?.danger ? "danger" : "primary"}
            loading={mutation.isPending}
            onClick={() =>
              action &&
              mutation.mutate(
                { action, note: note.trim() || null },
                {
                  onSuccess: () => {
                    toast.success("Etkinlik durumu güncellendi.");
                    close();
                  },
                },
              )
            }
          >
            {copy?.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{copy?.description}</p>
        {copy?.needsNote && (
          <Field label="İptal sebebi" required>
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        )}
        {mutation.isError && <p className="text-sm text-danger-600">{errorMessage(mutation.error)}</p>}
      </div>
    </Dialog>
  );
}

export function EventDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const event = useEvent(id);
  const [params, setParams] = useSearchParams();
  const tab = params.get("sekme") ?? "ozet";
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<EventAction | null>(null);

  if (event.isPending) return <LoadingState />;
  if (event.isError) return <ErrorState error={event.error} />;
  const e = event.data;
  const allowed = new Set(e.allowed_actions);
  const showMoney = can("finance.view");
  const c = e.currency;
  const topLevel = e.items.filter((i) => i.parent_id === null);
  const childrenOf = (itemId: number) => e.items.filter((i) => i.parent_id === itemId);

  return (
    <>
      <PageHeader
        back={{ to: "/etkinlikler", label: "Etkinlikler" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {e.title}
            <EventStatusBadge status={e.status} />
          </span>
        }
        description={`${e.event_no} · ${e.customer.name} · ${formatDate(e.event_date)}`}
        actions={
          <>
            {allowed.has("complete") && (
              <Button onClick={() => setAction("complete")}>
                <CheckCircle2 /> Gerçekleşti
              </Button>
            )}
            {allowed.has("edit") && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil /> Düzenle
              </Button>
            )}
            {allowed.has("reopen") && (
              <Button variant="secondary" onClick={() => setAction("reopen")}>
                <RotateCcw /> Yeniden Aç
              </Button>
            )}
            {allowed.has("cancel") && (
              <Button variant="secondary" onClick={() => setAction("cancel")}>
                <XCircle /> İptal Et
              </Button>
            )}
            {can("offers.view") && (
              <Button variant="ghost" asChild>
                <Link to={`/teklifler/${e.offer_id}`}>
                  <FileText /> {e.offer_no}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {e.status === "cancelled" && e.cancel_reason && (
        <div className="mb-6 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <strong className="font-medium">İptal sebebi:</strong> {e.cancel_reason}
        </div>
      )}

      <Tabs value={tab} onValueChange={(value) => setParams({ sekme: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="ozet">Özet</TabsTrigger>
          <TabsTrigger value="program">Program ({topLevel.length})</TabsTrigger>
          {showMoney && <TabsTrigger value="odemeler">Ödemeler</TabsTrigger>}
          {showMoney && <TabsTrigger value="kapanis">Kapanış</TabsTrigger>}
          <TabsTrigger value="operasyon">Operasyon</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Etkinlik Bilgileri" />
              <CardBody>
                <DescriptionList
                  items={[
                    { label: "Müşteri", value: <Link to={`/musteriler/${e.customer.id}`} className="text-brand-700 hover:underline">{e.customer.name}</Link> },
                    { label: "Yetkili", value: e.contact ? `${e.contact.name}${e.contact_phone ? ` · ${e.contact_phone}` : ""}` : null },
                    { label: "Tarih", value: formatDate(e.event_date) },
                    { label: "Saat", value: e.start_time ? `${hhmm(e.start_time)} – ${hhmm(e.end_time)}` : null },
                    { label: "Mekân", value: e.venue?.name },
                    { label: "Kişi sayısı", value: e.guest_count },
                    { label: "İşi getiren ortak", value: e.partner.name },
                    { label: "Anlaşma tarihi", value: formatDateTime(e.agreed_at) },
                    { label: "Not", value: e.notes, wide: true },
                  ]}
                />
              </CardBody>
            </Card>
            {showMoney && (
              <div className="space-y-6">
                <Card>
                  <CardHeader title="Anlaşma" description={INVOICE_LABELS[e.invoice_type]} />
                  <CardBody className="space-y-2">
                    <Row label="KDV hariç">
                      <Money amount={e.net_amount} currency={c} />
                    </Row>
                    {e.invoice_type === "with_invoice" && (
                      <Row label={`KDV (%${formatNumber(e.vat_rate)})`}>
                        <Money amount={e.vat_amount} currency={c} />
                      </Row>
                    )}
                    <div className="border-t border-line pt-2">
                      <Row label="Toplam" strong>
                        <Money amount={e.total_amount} currency={c} />
                      </Row>
                      {c !== "TRY" && (
                        <p className="mt-0.5 text-right text-xs text-ink-muted">
                          ≈ <Money amount={e.base_total_amount} /> · sabit kur 1 {c} = {formatNumber(e.exchange_rate)} TL
                        </p>
                      )}
                    </div>
                    {Number(e.advance_amount) > 0 && (
                      <div className="space-y-2 border-t border-line pt-2">
                        <Row label="Kapora">
                          <Money amount={e.advance_amount} currency={c} />
                        </Row>
                        <Row label="Kalan">
                          <Money amount={e.remaining_amount} currency={c} />
                        </Row>
                      </div>
                    )}
                  </CardBody>
                </Card>
                {e.profitability && (
                  <Card>
                    <CardHeader title="Planlanan Kârlılık (TL)" description="Gerçekleşen maliyetler finans aşamasında işlenecek." />
                    <CardBody className="space-y-2">
                      <Row label="Gelir (KDV hariç)">
                        <Money amount={e.profitability.revenue_base} />
                      </Row>
                      <Row label="Planlanan maliyet">
                        <Money amount={`-${e.profitability.cost_base}`} />
                      </Row>
                      <div className="border-t border-line pt-2">
                        <Row label="Tahmini kâr" strong>
                          <Money amount={e.profitability.profit_base} signed />
                        </Row>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="program">
          <Card>
            <CardHeader title="Program ve Kalemler" description="Anlaşmadaki haliyle; değişiklik ek protokolle yapılır." />
            <ul className="divide-y divide-line">
              {topLevel.map((item) => (
                <li key={item.id}>
                  <ul>
                    <LineRow line={item} currency={c} editable={false} hidePrices={!showMoney} />
                    {childrenOf(item.id).map((child) => (
                      <LineRow key={child.id} line={child} currency={c} nested editable={false} hidePrices={!showMoney} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        {showMoney && (
          <TabsContent value="odemeler">
            <EventFinanceTab eventId={e.id} cancelled={e.status === "cancelled"} />
          </TabsContent>
        )}
        {showMoney && (
          <TabsContent value="kapanis">
            <EventClosureTab eventId={e.id} />
          </TabsContent>
        )}
        <TabsContent value="operasyon">
          <OperationsTab eventId={e.id} eventDate={e.event_date} />
        </TabsContent>
      </Tabs>

      <EventEditDialog event={e} open={editing} onOpenChange={setEditing} />
      <ActionDialog event={e} action={action} onClose={() => setAction(null)} />
    </>
  );
}
