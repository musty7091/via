import type {
  CustomerContactCreatePayload,
  CustomerDetailBundle,
  CustomerLedgerMovementCreatePayload,
  CustomerVenueCreatePayload,
} from "../types/customerTypes";
import { CustomerContactList } from "./CustomerContactList";
import { CustomerLedger } from "./CustomerLedger";
import { CustomerSummaryCards } from "./CustomerSummaryCards";
import { CustomerVenueList } from "./CustomerVenueList";

type CustomerDetailPanelProps = {
  bundle: CustomerDetailBundle | null;
  isLoading: boolean;
  onOpenEditCustomer: () => void;
  onCreateContact: (payload: CustomerContactCreatePayload) => Promise<void>;
  onCreateVenue: (payload: CustomerVenueCreatePayload) => Promise<void>;
  onCreateMovement: (payload: CustomerLedgerMovementCreatePayload) => Promise<void>;
};

export function CustomerDetailPanel({
  bundle,
  isLoading,
  onOpenEditCustomer,
  onCreateContact,
  onCreateVenue,
  onCreateMovement,
}: CustomerDetailPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-[2rem] bg-white p-6 text-slate-500 shadow-sm">
        Müşteri detayları yükleniyor...
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500 shadow-sm">
        Detay görmek için müşteri seç.
      </div>
    );
  }

  const { customer, contacts, venues, ledger, summary } = bundle;

  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-teal-300">
              Müşteri Kartı
            </p>
            <h2 className="mt-3 text-3xl font-normal">{customer.name}</h2>
          </div>

          <button
            type="button"
            onClick={onOpenEditCustomer}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
          >
            Müşteri Bilgilerini Düzenle
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <span>Telefon: {customer.phone ?? "-"}</span>
          <span>E-posta: {customer.email ?? "-"}</span>
          <span>Şehir: {customer.city ?? "-"}</span>
          <span>Vergi No: {customer.tax_number ?? "-"}</span>
        </div>

        {customer.notes ? (
          <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-slate-200">
            {customer.notes}
          </p>
        ) : null}
      </section>

      <CustomerSummaryCards summary={summary} />

      <div className="grid gap-4 xl:grid-cols-2">
        <CustomerContactList
          contacts={contacts}
          onCreateContact={onCreateContact}
        />

        <CustomerVenueList venues={venues} onCreateVenue={onCreateVenue} />
      </div>

      <CustomerLedger ledger={ledger} onCreateMovement={onCreateMovement} />
    </div>
  );
}