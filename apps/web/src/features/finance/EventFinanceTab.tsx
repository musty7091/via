import { ArrowDownToLine, CalendarClock, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCan } from "@/features/auth/auth";
import { useDeletePlan, useEventFinance, type Payable, type PaymentPlan } from "@/features/finance/api";
import { CollectionDialog } from "@/features/finance/CollectionDialog";
import { ExpenseDialog } from "@/features/finance/ExpenseDialog";
import { CollectionsTable, ExpensesTable, PayablesTable } from "@/features/finance/FinanceTables";
import { PayableDialog } from "@/features/finance/PayableDialog";
import { PlanDialog } from "@/features/finance/PlanDialog";
import { errorMessage } from "@/shared/api/client";
import { formatDate, negate, type Currency } from "@/shared/lib/format";
import { PLAN_STATE } from "@/shared/lib/labels";
import { Badge, Button, Card, CardBody, CardHeader, ErrorState, LoadingState, Money, StatCard, toast } from "@/shared/ui";

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? "text-ink" : "text-ink-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function EventFinanceTab({ eventId, cancelled }: { eventId: number; cancelled: boolean }) {
  const can = useCan();
  const canRecord = can("finance.record") && !cancelled;
  const finance = useEventFinance(eventId);
  const deletePlan = useDeletePlan();
  const [dialog, setDialog] = useState<"collection" | "expense" | null>(null);
  const [payableForm, setPayableForm] = useState<Payable | null | undefined>(undefined);
  const [planForm, setPlanForm] = useState<PaymentPlan | null | undefined>(undefined);

  if (finance.isPending) return <LoadingState />;
  if (finance.isError) return <ErrorState error={finance.error} />;
  const f = finance.data;
  const c = f.currency as Currency;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Anlaşma toplamı" value={<Money amount={f.total_amount} currency={c} />} />
        <StatCard label="Tahsil edilen" value={<Money amount={f.collected_amount} currency={c} />} tone="success" />
        <StatCard
          label="Kalan alacak"
          value={<Money amount={f.remaining_amount} currency={c} />}
          tone={Number(f.remaining_amount) > 0 ? "warning" : "default"}
        />
      </div>

      {(Number(f.cancel_kept_amount) > 0 || Number(f.cancel_refunded_amount) > 0) && (
        <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm" role="status">
          <strong className="font-medium">Etkinlik iptal edildi.</strong> Şirkette kalan kapora:{" "}
          <Money amount={f.cancel_kept_amount} currency={c} />
          {Number(f.cancel_refunded_amount) > 0 && (
            <>
              {" "}
              · Müşteriye iade: <Money amount={f.cancel_refunded_amount} currency={c} />
            </>
          )}
        </div>
      )}

      {canRecord && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog("collection")} disabled={Number(f.remaining_amount) <= 0}>
            <ArrowDownToLine /> Tahsilat Gir
          </Button>
          <Button variant="secondary" onClick={() => setDialog("expense")}>
            <Receipt /> Gider Gir
          </Button>
          <Button variant="secondary" onClick={() => setPayableForm(null)}>
            <Plus /> Ek Maliyet
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Ödeme Planı"
              description={
                Number(f.plan_difference) !== 0
                  ? `Plan toplamı anlaşmadan farklı: fark ${f.plan_difference} ${c}`
                  : "Tahsilatlar vade sırasına göre plana dağıtılır."
              }
              actions={
                canRecord && (
                  <Button size="sm" variant="secondary" onClick={() => setPlanForm(null)}>
                    <Plus /> Satır
                  </Button>
                )
              }
            />
            <ul className="divide-y divide-line">
              {f.plans.map((p) => {
                const state = PLAN_STATE[p.state];
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <CalendarClock className="size-4 shrink-0 text-ink-faint" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {p.title} <Badge tone={state.tone}>{state.label}</Badge>
                      </p>
                      <p className="text-xs text-ink-muted">Vade {formatDate(p.due_date, "short")}</p>
                    </div>
                    <div className="text-right text-sm">
                      <Money amount={p.amount} currency={c} className="font-medium" />
                      {p.state === "partial" && (
                        <p className="text-xs text-ink-muted">
                          tahsil: <Money amount={p.covered_amount} currency={c} />
                        </p>
                      )}
                    </div>
                    {canRecord && (
                      <div className="flex">
                        <Button variant="ghost" size="icon" onClick={() => setPlanForm(p)} aria-label="Plan satırını düzenle">
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Plan satırını sil"
                          onClick={() =>
                            deletePlan.mutate(p.id, {
                              onSuccess: () => toast.success("Plan satırı silindi."),
                              onError: (e) => toast.error(errorMessage(e)),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Tahsilatlar" />
            <CollectionsTable rows={f.collections} showEvent={false} />
          </Card>

          <Card>
            <CardHeader title="Sanatçı ve Tedarikçi Borçları" description="Anlaşmadaki maliyetlerden otomatik açılır." />
            <PayablesTable rows={f.payables} showEvent={false} onEdit={canRecord ? setPayableForm : undefined} />
          </Card>

          <Card>
            <CardHeader title="Etkinlik Giderleri" />
            <ExpensesTable rows={f.expenses} showEvent={false} />
          </Card>
        </div>

        {can("costs.view") && (
          <Card className="h-fit">
            <CardHeader title="Gerçekleşen Kârlılık (TL)" description="Muhasebe defterinden" />
            <CardBody className="space-y-2">
              <Row label="Gelir (KDV hariç)">
                <Money amount={f.revenue_base} />
              </Row>
              <Row label="Sanatçı / hizmet maliyeti">
                <Money amount={negate(f.cost_base)} />
              </Row>
              <Row label="Ek giderler">
                <Money amount={negate(f.expense_base)} />
              </Row>
              {Number(f.fx_base) !== 0 && (
                <Row label="Kur farkı">
                  <Money amount={f.fx_base} signed />
                </Row>
              )}
              <div className="border-t border-line pt-2">
                <Row label="Kâr" strong>
                  <Money amount={f.profit_base} signed />
                </Row>
              </div>
              <div className="space-y-2 border-t border-line pt-2">
                <Row label="Müşteriden kalan alacak">
                  <Money amount={f.receivable_base} />
                </Row>
                <Row label="Ödenecek borç">
                  <Money amount={f.payables_remaining_base} />
                </Row>
              </div>
              <p className="pt-2 text-xs text-ink-muted">
                Kâr, tahsilat tamamlanıp etkinlik finans kapanışı yapıldığında ortaklara dağıtılır (Kapanış sekmesi).
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      <CollectionDialog open={dialog === "collection"} onOpenChange={(o) => !o && setDialog(null)} eventId={eventId} />
      <ExpenseDialog open={dialog === "expense"} onOpenChange={(o) => !o && setDialog(null)} eventId={eventId} />
      <PayableDialog
        open={payableForm !== undefined}
        onOpenChange={(o) => !o && setPayableForm(undefined)}
        eventId={eventId}
        payable={payableForm}
      />
      <PlanDialog eventId={eventId} currency={c} plan={planForm} onClose={() => setPlanForm(undefined)} />
    </div>
  );
}
