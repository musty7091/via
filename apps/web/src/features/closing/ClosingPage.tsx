import { AlertTriangle, CalendarRange, CheckCircle2, Lock, RotateCcw, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { useCan } from "@/features/auth/auth";
import { useClosePeriod, usePeriod, usePeriods, useReopenPeriod, type PeriodPreview } from "@/features/closing/api";
import { PrintLink } from "@/features/print/PrintLink";
import { formatDate, formatMoney, negate, type Currency } from "@/shared/lib/format";
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
  ReasonDialog,
  toast,
} from "@/shared/ui";

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? "text-ink" : "text-ink-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function PeriodReport({ p }: { p: PeriodPreview }) {
  const g = p.general;
  return (
    <div className="space-y-6">
      {p.warnings.length > 0 && (
        <ul className="space-y-1.5 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {p.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Ayın Sonucu (TL)" description="Ortaklara yazılan kâr ve zarar" />
          <CardBody className="space-y-2">
            <Row label="Bu ayın etkinliklerinin kârı">
              <Money amount={p.closed_events_profit} signed />
            </Row>
            <Row label="Genel giderler">
              <Money amount={negate(g.direct_expenses)} />
            </Row>
            {Number(g.spread_expenses) > 0 && (
              <Row label="Sezonluk gider payları">
                <Money amount={negate(g.spread_expenses)} />
              </Row>
            )}
            {Number(g.fx) !== 0 && (
              <Row label="Şirket geneli kur farkı">
                <Money amount={g.fx} signed />
              </Row>
            )}
            <div className="border-t border-line pt-2">
              <Row label="Ay sonucu" strong>
                <Money amount={p.month_result} signed />
              </Row>
            </div>
            {g.spread_items.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-soft">
                {g.spread_items.map((i) => (
                  <li key={i.expense_no} className="flex justify-between gap-3">
                    <span>
                      {i.title} ({i.months} aya bölünmüş)
                    </span>
                    <Money amount={i.share} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Ortaklar" description="Bu ay yazılan pay ve ay sonu bakiyeleri (TL)" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-5 py-2 font-medium">Ortak</th>
                  <th className="px-3 py-2 text-right font-medium">Bu ay pay</th>
                  <th className="px-3 py-2 text-right font-medium">Üzerinde</th>
                  <th className="px-5 py-2 text-right font-medium">Şirketin borcu</th>
                </tr>
              </thead>
              <tbody>
                {p.partners.map((partner) => (
                  <tr key={partner.partner_id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5">{partner.name}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Money amount={partner.distributed_in_month} signed />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Money amount={partner.held_base} />
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Money amount={partner.owed_base} signed />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.status === "open" && Number(g.total) !== 0 && (
            <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
              Kapanışta genel sonuç ({formatMoney(g.total)}) ortaklara eşit yansıtılacak:{" "}
              {p.distribution_preview.map((s) => `${s.name} ${formatMoney(s.share)}`).join(", ")}.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Ay Sonu Kasa ve Banka" />
          <CardBody className="space-y-2">
            {p.cash.map((c) => (
              <Row key={c.name} label={c.name}>
                <Money amount={c.amount} currency={c.currency as Currency} />
              </Row>
            ))}
            <div className="border-t border-line pt-2">
              <Row label="Toplam (TL karşılığı)" strong>
                <Money amount={p.cash_total_base} />
              </Row>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Devreden Kalemler ve Ay Hareketleri" />
          <CardBody className="space-y-2">
            <Row label="Müşterilerden alacak (devreden)">
              <Money amount={p.receivables_base} />
            </Row>
            <Row label="Sanatçı / tedarikçi borcu (devreden)">
              <Money amount={p.payables_base} />
            </Row>
            <div className="space-y-2 border-t border-line pt-2">
              <Row label="Bu ay tahsilat">
                <Money amount={p.collections_base} />
              </Row>
              <Row label="Bu ay sanatçı/tedarikçi ödemesi">
                <Money amount={p.payments_base} />
              </Row>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Bu Ayın Etkinlikleri" />
        {p.events.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Bu ay etkinlik yok" />
        ) : (
          <ul className="divide-y divide-line">
            {p.events.map((e) => (
              <li key={e.event_id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <Link to={`/etkinlikler/${e.event_id}?sekme=kapanis`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-medium">{e.title}</span>
                  <span className="text-ink-muted"> · {e.event_no} · {formatDate(e.event_date, "short")}</span>
                </Link>
                {e.closed ? (
                  <>
                    <Badge tone="success">Kapandı</Badge>
                    <Money amount={e.profit ?? "0"} signed />
                  </>
                ) : (
                  <Badge tone="warning">Kapanış bekliyor</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ClosingPage() {
  const can = useCan();
  const periods = usePeriods();
  const [selected, setSelected] = useState("");
  const list = periods.data ?? [];
  const month = selected || list.find((p) => p.status === "open")?.month || list[0]?.month || "";
  const period = usePeriod(month);
  const close = useClosePeriod();
  const reopen = useReopenPeriod();
  const [dialog, setDialog] = useState<"close" | "reopen" | null>(null);
  const p = period.data;

  return (
    <>
      <PageHeader
        eyebrow="Finans"
        title="Dönem Kapanışları"
        description="Ay sonunda genel giderler ortaklara yansıtılır ve dönem kilitlenir; kapanan aya kayıt girilemez."
      />
      {periods.isPending ? (
        <LoadingState />
      ) : periods.isError ? (
        <ErrorState error={periods.error} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <Card className="h-fit">
            <CardHeader title="Dönemler" />
            <ul className="divide-y divide-line">
              {list.map((row) => (
                <li key={row.month}>
                  <button
                    type="button"
                    onClick={() => setSelected(row.month)}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm ${row.month === month ? "bg-brand-50" : "hover:bg-surface-muted"}`}
                  >
                    <span className="font-medium">{row.label}</span>
                    {row.status === "closed" ? (
                      <Badge tone="neutral">
                        <Lock className="size-3" aria-hidden /> Kapalı
                      </Badge>
                    ) : (
                      <Badge tone="info">Açık</Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="min-w-0 space-y-6">
            {period.isPending && month ? (
              <LoadingState />
            ) : period.isError ? (
              <ErrorState error={period.error} />
            ) : p ? (
              <>
                <Card>
                  <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl">{p.label}</h2>
                      <p className="text-sm text-ink-muted">
                        {p.status === "closed" ? "Kapalı dönem · rapor kapanış anındaki haliyle donduruldu" : "Açık dönem · rakamlar canlı"}
                      </p>
                    </div>
                    <PrintLink to={`/yazdir/donem/${p.month}`} label="Raporu yazdır" />
                    {p.status === "open" && can("period.close") && (
                      <Button onClick={() => setDialog("close")} disabled={!p.can_close}>
                        <Lock /> Dönemi Kapat
                      </Button>
                    )}
                    {p.status === "closed" && can("period.reopen") && (
                      <Button variant="secondary" onClick={() => setDialog("reopen")}>
                        <RotateCcw /> Dönemi Aç
                      </Button>
                    )}
                  </div>
                  {p.status === "open" && (
                    <ul className="space-y-1 border-t border-line px-5 py-3 text-sm">
                      {p.blockers.length === 0 ? (
                        <li className="flex gap-2 text-success-700">
                          <CheckCircle2 className="mt-0.5 size-4" aria-hidden /> Dönem kapatılabilir.
                        </li>
                      ) : (
                        p.blockers.map((b) => (
                          <li key={b} className="flex gap-2 text-danger-700">
                            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {b}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </Card>
                <PeriodReport p={p} />
              </>
            ) : null}
          </div>
        </div>
      )}

      {p && (
        <ConfirmDialog
          open={dialog === "close"}
          onOpenChange={(o) => !o && setDialog(null)}
          title={`${p.label} Dönemi Kapatılacak`}
          description="Dönem kilitlenecek ve rapor dondurulacak."
          effects={[
            `Genel sonuç ${formatMoney(p.general.total)} ortaklara eşit yansıtılacak.`,
            "Bu aya tarihli hiçbir kayıt girilemeyecek.",
            "Açık alacak, borç ve ortak bakiyeleri sonraki aya devredecek.",
          ]}
          confirmLabel="Dönemi Kapat"
          tone="danger"
          loading={close.isPending}
          onConfirm={() =>
            close.mutate(p.month, {
              onSuccess: () => {
                toast.success(`${p.label} dönemi kapatıldı.`);
                setDialog(null);
              },
              onError: (e) => toast.error(e.message),
            })
          }
        />
      )}
      <ReasonDialog
        open={dialog === "reopen"}
        onOpenChange={(o) => {
          if (!o) {
            reopen.reset();
            setDialog(null);
          }
        }}
        title="Dönem Yeniden Açılacak"
        description="Ortaklara yansıtılan genel sonuç ters kayıtla geri alınır ve aya yeniden kayıt girilebilir. Sadece en son kapanan dönem açılabilir."
        confirmLabel="Dönemi Aç"
        loading={reopen.isPending}
        error={reopen.error}
        onConfirm={(reason) =>
          reopen.mutate(
            { month, reason },
            {
              onSuccess: () => {
                toast.success("Dönem yeniden açıldı.");
                setDialog(null);
              },
            },
          )
        }
      />
    </>
  );
}

