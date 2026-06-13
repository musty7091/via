import {
  customerTypeOptions,
  getOptionLabel,
  riskLevelOptions,
} from "../constants/customerConstants";
import type { CustomerListItem } from "../types/customerTypes";

type CustomerSelectorProps = {
  customers: CustomerListItem[];
  selectedCustomerId: number | null;
  selectedCustomerName: string | null;
  search: string;
  pageIndex: number;
  hasNextPage: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSelectCustomer: (customerId: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function CustomerSelector({
  customers,
  selectedCustomerId,
  selectedCustomerName,
  search,
  pageIndex,
  hasNextPage,
  isLoading,
  isOpen,
  onToggleOpen,
  onSearchChange,
  onSearchSubmit,
  onSelectCustomer,
  onPreviousPage,
  onNextPage,
}: CustomerSelectorProps) {
  return (
    <section className="relative rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_620px] xl:items-center">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-700">
            Müşteri Seç
          </p>

          <h2 className="mt-2 truncate text-2xl font-black text-slate-950">
            {selectedCustomerName ?? "Müşteri seçilmedi"}
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Müşteri arayın, seçin ve alt bölümde yetkili kişi, mekan ve cari
            bilgilerini yönetin.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="flex gap-2">
            <input
              value={search}
              onFocus={() => {
                if (!isOpen) {
                  onToggleOpen();
                }
              }}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSearchSubmit();
                }
              }}
              placeholder="Müşteri adı, telefon veya vergi no ara..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <button
              type="button"
              onClick={onSearchSubmit}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Ara
            </button>

            <button
              type="button"
              onClick={onToggleOpen}
              className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
            >
              {isOpen ? "Gizle" : "Seç"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">
            <button
              type="button"
              disabled={pageIndex === 0 || isLoading}
              onClick={onPreviousPage}
              className="rounded-full bg-slate-100 px-3 py-2 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Önceki
            </button>

            <span className="rounded-full bg-slate-50 px-3 py-2 text-slate-500">
              Sayfa {pageIndex + 1} • 6 kayıt / sayfa
            </span>

            <button
              type="button"
              disabled={!hasNextPage || isLoading}
              onClick={onNextPage}
              className="rounded-full bg-slate-100 px-3 py-2 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sonraki →
            </button>
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%-0.75rem)] z-30 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300 xl:left-auto xl:w-[620px]">
          {isLoading ? (
            <div className="p-5 text-sm text-slate-500">
              Müşteriler yükleniyor...
            </div>
          ) : customers.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Kayıt bulunamadı. Arama metnini değiştir veya yeni müşteri oluştur.
            </div>
          ) : (
            <div className="max-h-[430px] overflow-y-auto">
              {customers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;

                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => onSelectCustomer(customer.id)}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                      isSelected ? "bg-teal-50" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {customer.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getOptionLabel(
                            customerTypeOptions,
                            customer.customer_type
                          )}
                          {customer.city ? ` • ${customer.city}` : ""}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          customer.is_active
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {customer.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {customer.phone ?? "Telefon yok"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {customer.default_currency}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Risk:{" "}
                        {getOptionLabel(riskLevelOptions, customer.risk_level)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}