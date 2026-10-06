import { ArrowDownToLine, ArrowRightLeft, HandCoins } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/features/auth/auth";
import type { PartnerBalance } from "@/features/finance/api";
import { PartnerTxDialog, type PartnerTxKind } from "@/features/finance/PartnerTxDialog";
import { Button, Card, CardHeader, Money } from "@/shared/ui";

/** Ortakların şirket parası ve şirketin ortaklara borcu; teslim / ödeme / mahsup işlemleri. */
export function PartnerBalancesCard({ balances, showActions = true }: { balances: PartnerBalance[]; showActions?: boolean }) {
  const can = useCan();
  const canRecord = can("finance.record") && showActions;
  const [tx, setTx] = useState<{ kind: PartnerTxKind; balance: PartnerBalance } | null>(null);

  return (
    <Card>
      <CardHeader title="Ortak Hesapları" description="Ortak üzerindeki şirket parası ve şirketin ortağa borcu" />
      <ul className="divide-y divide-line">
        {balances.map((b) => {
          const holds = Number(b.held_base) > 0;
          const owed = Number(b.owed_base) > 0;
          const indebted = Number(b.owed_base) < 0;
          return (
            <li key={b.partner.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{b.partner.name}</p>
                {!holds && !owed && !indebted && <span className="text-xs text-success-700">Hesap kapalı</span>}
              </div>
              <div className="mt-1 space-y-0.5 text-sm">
                {b.held.map((h) => (
                  <p key={`h-${h.currency}`} className="text-warning-700">
                    Üzerinde şirket parası: <Money amount={h.amount} currency={h.currency} />
                  </p>
                ))}
                {b.owed.map((o) =>
                  Number(o.amount) >= 0 ? (
                    <p key={`o-${o.currency}`} className="text-info-700">
                      Şirketin ona borcu: <Money amount={o.amount} currency={o.currency} />
                    </p>
                  ) : (
                    <p key={`o-${o.currency}`} className="text-danger-700">
                      Şirkete borcu (zarar payı): <Money amount={String(-Number(o.amount))} currency={o.currency} />
                    </p>
                  ),
                )}
              </div>
              {canRecord && (holds || owed) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {holds && (
                    <Button size="sm" variant="secondary" onClick={() => setTx({ kind: "handover", balance: b })}>
                      <ArrowDownToLine /> Teslim al
                    </Button>
                  )}
                  {owed && (
                    <Button size="sm" variant="secondary" onClick={() => setTx({ kind: "payout", balance: b })}>
                      <HandCoins /> Ortağa öde
                    </Button>
                  )}
                  {holds && owed && (
                    <Button size="sm" variant="secondary" onClick={() => setTx({ kind: "offset", balance: b })}>
                      <ArrowRightLeft /> Mahsup et
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <PartnerTxDialog
        key={tx ? `${tx.kind}-${tx.balance.partner.id}` : "closed"}
        kind={tx?.kind ?? null}
        balance={tx?.balance ?? null}
        onClose={() => setTx(null)}
      />
    </Card>
  );
}
