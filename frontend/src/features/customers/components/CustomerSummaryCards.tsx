import type { CustomerLedgerSummary } from "../types/customerTypes";
import { formatMoney } from "./formatters";

type CustomerSummaryCardsProps = {
  summary: CustomerLedgerSummary | null;
};

export function CustomerSummaryCards({ summary }: CustomerSummaryCardsProps) {
  const totalDebit = summary?.total_debit_base_amount ?? 0;
  const totalCredit = summary?.total_credit_base_amount ?? 0;
  const balance = summary?.balance_base_amount ?? 0;
  const movementCount = summary?.movement_count ?? 0;

  const cards = [
    {
      title: "Toplam Borç",
      value: formatMoney(totalDebit),
      description: "Müşteriye borçlandırılan toplam tutar.",
    },
    {
      title: "Toplam Tahsilat",
      value: formatMoney(totalCredit),
      description: "Müşteriden alınan toplam ödeme.",
    },
    {
      title: "Kalan Bakiye",
      value: formatMoney(balance),
      description: "Borç eksi tahsilat.",
    },
    {
      title: "Hareket Sayısı",
      value: String(movementCount),
      description: "Cari hesap satırı.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.title}
          className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            {card.title}
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">{card.value}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {card.description}
          </p>
        </article>
      ))}
    </div>
  );
}