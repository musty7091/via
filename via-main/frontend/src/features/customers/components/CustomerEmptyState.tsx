import {
  customerTypeOptions,
  getOptionLabel,
  riskLevelOptions,
} from "../constants/customerConstants";
import type {
  CustomerLedgerSummary,
  CustomerListItem,
} from "../types/customerTypes";

type CustomerEmptyStateProps = {
  customers: CustomerListItem[];
  customerSummaries: Record<number, CustomerLedgerSummary | null>;
  onOpenSelector: () => void;
  onOpenCreatePanel: () => void;
  onSelectCustomer: (customerId: number) => void;
};

export function CustomerEmptyState({
  customers,
  customerSummaries,
  onOpenSelector,
  onOpenCreatePanel,
  onSelectCustomer,
}: CustomerEmptyStateProps) {
  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-300">
          <p className="text-xs font-normal uppercase tracking-[0.3em] text-teal-300">
            Müşteri Çalışma Alanı
          </p>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-3xl font-normal tracking-tight">
                Müşteri seçildiğinde detay ekranı burada açılır.
              </h2>

              <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-200 font-normal">
                Müşteri seçtiğinde yetkili kişiler, mekanlar ve cari hareketler
                bu alanda görüntülenir. Aşağıdaki kartlardan doğrudan müşteri
                seçebilirsin.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenSelector}
                className="rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
              >
                Müşteri Seç
              </button>

              <button
                type="button"
                onClick={onOpenCreatePanel}
                className="rounded-full bg-teal-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-teal-300"
              >
                Yeni Müşteri
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-teal-700">
              Müşteri Kartları
            </p>
            <h3 className="mt-2 text-2xl font-normal text-slate-950">
              Sayfadaki müşteriler
            </h3>
            <p className="mt-1 text-sm font-normal text-slate-500">
              Karttan müşteri seçerek detay ekranına geçebilirsin.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            Maksimum 6 kart / sayfa
          </span>
        </div>

        {customers.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-normal text-slate-500">
            Bu sayfada müşteri bulunamadı. Arama metnini değiştir veya yeni
            müşteri oluştur.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* HATA DÜZELTİLDİ: slice(0, 3) kaldırılarak listedeki tüm kayıtların (6'ya kadar) görünmesi sağlandı. */}
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => onSelectCustomer(customer.id)}
                className="group rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-medium text-slate-950">
                      {customer.name}
                    </p>

                    <p className="mt-1 text-xs font-normal text-slate-500">
                      {getOptionLabel(
                        customerTypeOptions,
                        customer.customer_type
                      )}
                      {customer.city ? ` • ${customer.city}` : ""}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      customer.is_active
                        ? "bg-teal-100 text-teal-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {customer.is_active ? "Aktif" : "Pasif"}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl bg-white p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Cari Bakiye
                  </p>

                  <p className="mt-2 text-2xl font-normal text-slate-950">
                    {formatBalance(customerSummaries[customer.id])}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                  <span className="rounded-full bg-white px-2.5 py-1">
                    {customer.phone ?? "Telefon yok"}
                  </span>

                  <span className="rounded-full bg-white px-2.5 py-1">
                    Risk: {getOptionLabel(riskLevelOptions, customer.risk_level)}
                  </span>

                  <span className="rounded-full bg-white px-2.5 py-1">
                    {customer.default_currency}
                  </span>
                </div>

                <p className="mt-4 text-xs font-medium text-teal-700">
                  Detaya geç →
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatBalance(summary: CustomerLedgerSummary | null | undefined) {
  if (summary === undefined) {
    return "Yükleniyor...";
  }

  if (summary === null) {
    return "₺0,00";
  }

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(summary.balance_base_amount || 0);
}