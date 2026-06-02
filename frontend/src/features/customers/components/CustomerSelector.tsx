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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
            Müşteri Seç
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-950">
            {selectedCustomerName ?? "Müşteri seçilmedi"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Müşteriyi arayıp seç; detaylar altta tam genişlikte açılır.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-[520px]">
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
              onClick={onSearchSubmit}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
            >
              Ara
            </button>

            <button
              onClick={onToggleOpen}
              className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"
            >
              {isOpen ? "Gizle" : "Seç"}
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-400">
            Sayfa {pageIndex + 1} • En fazla 20 kayıt gösterilir.
          </p>
        </div>
      </div>

      {isOpen ? (
        <div className="absolute left-4 right-4 top-[calc(100%-0.75rem)] z-30 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300 lg:left-auto lg:w-[560px]">
          {isLoading ? (
            <div className="p-5 text-sm text-slate-500">
              Müşteriler yükleniyor...
            </div>
          ) : customers.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Kayıt bulunamadı. Arama metnini değiştir veya yeni müşteri oluştur.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {customers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;

                return (
                  <button
                    key={customer.id}
                    onClick={() => onSelectCustomer(customer.id)}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                      isSelected
                        ? "bg-teal-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {customer.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getOptionLabel(customerTypeOptions, customer.customer_type)}
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
                        Risk: {getOptionLabel(riskLevelOptions, customer.risk_level)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 p-3">
            <button
              disabled={pageIndex === 0 || isLoading}
              onClick={onPreviousPage}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Önceki
            </button>

            <span className="text-xs font-bold text-slate-500">
              20 kayıt / sayfa
            </span>

            <button
              disabled={!hasNextPage || isLoading}
              onClick={onNextPage}
              className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
