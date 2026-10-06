import { useCan } from "@/features/auth/auth";
import { useCustomerStatement } from "@/features/finance/api";
import { StatementTable } from "@/features/finance/StatementTable";
import { PrintLink } from "@/features/print/PrintLink";
import { Card, CardHeader, ErrorState, Money } from "@/shared/ui";

/** Müşteri cari hesabı: anlaşmalar borç, tahsilatlar alacak olarak defterden gelir. */
export function CustomerLedgerTab({ customerId }: { customerId: number }) {
  const can = useCan();
  const statement = useCustomerStatement(customerId);
  if (!can("finance.view")) return null;
  if (statement.isError) return <ErrorState error={statement.error} />;
  const rows = statement.data ?? [];
  const balance = rows.length ? rows[rows.length - 1].running_base : "0";
  return (
    <Card>
      <CardHeader
        title="Cari Hesap"
        description="Elle hareket girilmez; anlaşma ve tahsilatlardan otomatik oluşur. Tutarlar TL karşılığıdır."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              Bakiye: <Money amount={balance} className="font-semibold" />
            </span>
            <PrintLink to={`/yazdir/ekstre/musteri/${customerId}`} />
          </div>
        }
      />
      <StatementTable rows={rows} loading={statement.isPending} debitLabel="Borç" creditLabel="Tahsilat" balanceLabel="Bakiye" />
    </Card>
  );
}
