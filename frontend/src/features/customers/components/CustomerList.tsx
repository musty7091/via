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
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
        Henüz müşteri kaydı yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {customers.map((customer) => {
        const isSelected = selectedCustomerId === customer.id;

        return (
          <button
            key={customer.id}
            onClick={() => onSelectCustomer(customer.id)}
            className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
              isSelected
                ? "border-teal-400 bg-teal-50"
                : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black text-slate-950">
                  {customer.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {getOptionLabel(customerTypeOptions, customer.customer_type)}
                  {customer.city ? ` • ${customer.city}` : ""}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  customer.is_active
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {customer.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <span>{customer.phone ?? "Telefon yok"}</span>
              <span>{customer.email ?? "E-posta yok"}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {customer.default_currency}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Risk: {getOptionLabel(riskLevelOptions, customer.risk_level)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}