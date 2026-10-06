import { CheckCircle2, CircleAlert, Lock, RotateCcw, XCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

import { useCan } from "@/features/auth/auth";
import { useCloseEvent, useEventClosure, useReopenEvent, useWriteOff } from "@/features/closing/api";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  Money,
  ReasonDialog,
  toast,
} from "@/shared/ui";

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-base font-semibold" : "text-sm"}`}>
      <span className={strong ? "text-ink" : "text-ink-muted"}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function EventClosureTab({ eventId }: { eventId: number }) {
  const can = useCan();
  const canApprove = can("finance.approve");
  const preview = useEventClosure(eventId);
  const close = useCloseEvent(eventId);
  const reopen = useReopenEvent(eventId);
  const writeOff = useWriteOff(eventId);
  const [dialog, setDialog] = useState<"close" | "reopen" | "writeoff" | null>(null);

  if (preview.isPending) return <LoadingState />;
  if (preview.isError) return <ErrorState error={preview.error} />;
  const p = preview.data;
  const active = p.active_closure;
  const profit = Number(active?.profit ?? p.profit);
  const shares = active?.shares ?? p.shares;
  const collectedCheck = p.checks.find((c) => c.key === "collected");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {active ? (
          <div className="flex items-start gap-3 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">Finans kapanışı yapıldı · {formatDateTime(active.closed_at)}</p>
              <p>
                {profit >= 0 ? "Kâr" : "Zarar"} ortaklara eşit dağıtıldı. Bu etkinliğe kârı değiştirecek kayıt
                girilemez; açık sanatçı borçları ödenebilir.
              </p>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader title="Kapanış Kontrolleri" description="Kâr, etkinlik gerçekleşip müşteri alacağı tamamen kapandığında dağıtılır." />
            <ul className="divide-y divide-line">
              {p.checks.map((check) => (
                <li key={check.key} className="flex gap-3 px-5 py-3 text-sm">
                  {check.ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden />
                  ) : check.blocking ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger-600" aria-hidden />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-600" aria-hidden />
                  )}
                  <div>
                    <p className="font-medium text-ink">{check.label}</p>
                    {check.detail && <p className="text-ink-muted">{check.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {canApprove && (
              <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
                <Button onClick={() => setDialog("close")} disabled={!p.can_close}>
                  <Lock /> Finans Kapanışı Yap
                </Button>
                {collectedCheck && !collectedCheck.ok && (
                  <Button variant="secondary" onClick={() => setDialog("writeoff")}>
                    Kalan alacağı sil
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        {p.history.length > 0 && (
          <Card>
            <CardHeader title="Kapanış Geçmişi" />
            <ul className="divide-y divide-line text-sm">
              {p.history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Badge tone={h.status === "closed" ? "success" : "neutral"}>{h.status === "closed" ? "Aktif" : "Geri alındı"}</Badge>
                  <span className="text-ink-muted">{formatDateTime(h.closed_at)}</span>
                  <span className="flex-1">
                    <Money amount={h.profit} signed />
                  </span>
                  {h.reopen_reason && <span className="w-full text-xs text-ink-muted">Geri alma gerekçesi: {h.reopen_reason}</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title={active ? "Dağıtılan Sonuç (TL)" : "Dağıtılacak Sonuç (TL)"} />
          <CardBody className="space-y-2">
            <Row label="Gelir (KDV hariç)">
              <Money amount={active?.revenue ?? p.revenue} />
            </Row>
            <Row label="Sanatçı / hizmet maliyeti">
              <Money amount={`-${active?.cost ?? p.cost}`} />
            </Row>
            <Row label="Giderler">
              <Money amount={`-${active?.expense ?? p.expense}`} />
            </Row>
            {Number(active?.fx ?? p.fx) !== 0 && (
              <Row label="Kur farkı">
                <Money amount={active?.fx ?? p.fx} signed />
              </Row>
            )}
            <div className="border-t border-line pt-2">
              <Row label={profit >= 0 ? "Kâr" : "Zarar"} strong>
                <Money amount={active?.profit ?? p.profit} signed />
              </Row>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ortak Payları" description="Eşit bölünür; artan kuruş kuruş sırasıyla dağıtılır." />
          <ul className="divide-y divide-line">
            {shares.map((s) => (
              <li key={s.partner_id} className="flex justify-between px-5 py-2.5 text-sm">
                <span>{s.name}</span>
                <Money amount={s.share} signed className="font-medium" />
              </li>
            ))}
          </ul>
        </Card>
        {active && canApprove && (
          <Button variant="secondary" className="w-full" onClick={() => setDialog("reopen")}>
            <RotateCcw /> Kapanışı geri al
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "close"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Etkinlik Finans Kapanışı Yapılacak"
        description={`${profit >= 0 ? "Kâr" : "Zarar"} ortaklara eşit dağıtılacak.`}
        effects={[
          ...shares.map((s) => `${s.name}: ${formatMoney(s.share)}`),
          "Bu etkinliğe kârı değiştirecek kayıt girilemeyecek.",
        ]}
        confirmLabel="Kapanışı Yap"
        loading={close.isPending}
        onConfirm={() =>
          close.mutate(
            {},
            {
              onSuccess: () => {
                toast.success("Finans kapanışı yapıldı; paylar ortak hesaplarına yazıldı.");
                setDialog(null);
              },
              onError: (e) => toast.error(e.message),
            },
          )
        }
      />
      <ReasonDialog
        open={dialog === "writeoff"}
        onOpenChange={(o) => {
          if (!o) {
            writeOff.reset();
            setDialog(null);
          }
        }}
        title="Kalan Alacak Silinecek"
        description="Tahsil edilemeyecek alacak gider olarak etkinlik kârından düşülür."
        confirmLabel="Alacağı Sil"
        loading={writeOff.isPending}
        error={writeOff.error}
        onConfirm={(reason) =>
          writeOff.mutate(reason, {
            onSuccess: () => {
              toast.success("Kalan alacak silindi.");
              setDialog(null);
            },
          })
        }
      />
      <ReasonDialog
        open={dialog === "reopen"}
        onOpenChange={(o) => {
          if (!o) {
            reopen.reset();
            setDialog(null);
          }
        }}
        title="Kapanış Geri Alınacak"
        description="Ortaklara yazılan paylar ters kayıtla geri alınır; etkinlik yeniden düzenlenebilir olur."
        confirmLabel="Geri Al"
        loading={reopen.isPending}
        error={reopen.error}
        onConfirm={(reason) =>
          reopen.mutate(reason, {
            onSuccess: () => {
              toast.success("Kapanış geri alındı.");
              setDialog(null);
            },
          })
        }
      />
    </div>
  );
}
