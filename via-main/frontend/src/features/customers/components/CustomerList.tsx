import {
  customerTypeOptions,
  getOptionLabel,
  riskLevelOptions,
} from "../constants/customerConstants";
import type { CustomerListItem } from "../types/customerTypes";

type CustomerListProps = {
  customers: CustomerListItem[];
  selectedCustomerId: number | null;
  onSelectCustomer: (customerId: number) => void;
};

export function CustomerList({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-medium text-slate-700">
          Henüz müşteri kaydı yok.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Yeni müşteri butonuyla ilk kartı oluşturabilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="divide-y divide-slate-100">
        {customers.map((customer) => {
          const isSelected = selectedCustomerId === customer.id;

          return (
            <button
              key={customer.id}
              onClick={() => onSelectCustomer(customer.id)}
              className={`w-full px-4 py-3 text-left transition ${
                isSelected
                  ? "bg-teal-50"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">
                    {customer.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {getOptionLabel(customerTypeOptions, customer.customer_type)}
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
                  Risk: {getOptionLabel(riskLevelOptions, customer.risk_level)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}