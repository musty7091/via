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
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              onToggleOpen();
            }
          }}
          className="flex cursor-pointer select-none items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 transition hover:bg-slate-100"
        >
          <div className="min-w-0 pr-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
              Aktif Müşteri
            </p>
            <p className="mt-1 truncate text-lg font-normal text-slate-950">
              {selectedCustomerName ?? "Seçim yapılmadı"}
            </p>
          </div>

          <span className="shrink-0 rounded-full bg-white p-2 shadow-sm">
            {isOpen ? "▲" : "▼"}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSearchSubmit();
                }
              }}
              placeholder="Müşteri ara..."
              className="h-12 w-full min-w-0 rounded-full border border-slate-200 bg-white px-5 text-sm outline-none transition focus:border-teal-500"
            />
            <button
              type="button"
              onClick={onSearchSubmit}
              disabled={isLoading}
              className="shrink-0 rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              Bul
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onPreviousPage}
              disabled={pageIndex === 0 || isLoading}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:bg-slate-50 disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              onClick={onNextPage}
              disabled={!hasNextPage || isLoading}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:bg-slate-50 disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
          {customers.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-slate-500">
              Aramaya uygun müşteri bulunamadı.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {customers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;

                return (
                  <button
                    key={customer.id}
                    onClick={() => onSelectCustomer(customer.id)}
                    className={`w-full px-5 py-4 text-left transition ${
                      isSelected
                        ? "bg-teal-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                          {customer.tax_number ?? "Vergi No Yok"}
                        </p>
                        <p className="truncate text-sm font-medium text-slate-950">
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
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          customer.is_active
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {customer.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
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