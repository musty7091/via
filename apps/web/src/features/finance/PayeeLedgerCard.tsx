import { Link } from "react-router";

import { usePayeeStatement } from "@/features/finance/api";
import { StatementTable } from "@/features/finance/StatementTable";
import { PrintLink } from "@/features/print/PrintLink";
import { Card, CardHeader, ErrorState, Money } from "@/shared/ui";

/** Sanatçı / tedarikçi cari hesabı: anlaşma ve giderlerden borçlanma, ödemelerle kapanış. */
export function PayeeLedgerCard({ kind, id }: { kind: "artists" | "suppliers"; id: number }) {
  const statement = usePayeeStatement(kind, id);
  if (statement.isError) return <ErrorState error={statement.error} />;
  const rows = statement.data ?? [];
  const balance = rows.length ? rows[rows.length - 1].running_base : "0";
  return (
    <Card className="mt-6">
      <CardHeader
        title="Cari Hesap"
        description="Elle hareket girilmez; borçlar anlaşma ve giderlerden, ödemeler Finans Merkezi'nden gelir. Tutarlar TL karşılığıdır."
        actions={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Kalan borcumuz:{" "}
              <Money amount={balance} className={Number(balance) > 0 ? "font-semibold text-danger-700" : "font-semibold"} />
            </span>
            <PrintLink to={`/yazdir/ekstre/${kind === "artists" ? "sanatci" : "tedarikci"}/${id}`} />
            {Number(balance) > 0 && (
              <Link to="/finans/borclar" className="text-brand-700 hover:underline">
                Ödeme yap
              </Link>
            )}
          </div>
        }
      />
      <StatementTable rows={rows} loading={statement.isPending} debitLabel="Ödeme" creditLabel="Borçlanma" balanceLabel="Kalan borç" />
    </Card>
  );
}
