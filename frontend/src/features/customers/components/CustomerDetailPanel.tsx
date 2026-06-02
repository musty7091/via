import { useEffect, useState } from "react";

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
  onCreateContact: (payload: CustomerContactCreatePayload) => Promise<void>;
  onCreateVenue: (payload: CustomerVenueCreatePayload) => Promise<void>;
  onCreateMovement: (payload: CustomerLedgerMovementCreatePayload) => Promise<void>;
};

type DetailTab = "overview" | "contacts" | "venues" | "ledger";

const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Genel" },
  { key: "contacts", label: "Yetkililer" },
  { key: "venues", label: "MekÃ¢nlar" },
  { key: "ledger", label: "Hesap" },
];

export function CustomerDetailPanel({
  bundle,
  isLoading,
  onCreateContact,
  onCreateVenue,
  onCreateMovement,
}: CustomerDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [bundle?.customer.id]);

  if (isLoading) {
    return (
      <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
        MÃ¼ÅŸteri detaylarÄ± yÃ¼kleniyor...
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <div>
          <p className="text-lg font-black text-slate-800">
            Detay gÃ¶rmek iÃ§in mÃ¼ÅŸteri seÃ§.
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            MÃ¼ÅŸteri seÃ§ildiÄŸinde genel bilgiler, yetkililer, mekÃ¢nlar ve cari
            hesap hareketleri burada gÃ¶rÃ¼necek.
          </p>
        </div>
      </div>
    );
  }

  const { customer, contacts, venues, ledger, summary } = bundle;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-300">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
                MÃ¼ÅŸteri KartÄ±
              </p>
              <h2 className="mt-3 text-3xl font-black">{customer.name}</h2>
              <p className="mt-2 text-sm text-slate-300">
                {customer.short_name ? `${customer.short_name} â€¢ ` : ""}
                {customer.city ?? "Åehir yok"}
                {customer.district ? ` / ${customer.district}` : ""}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-black ${
                customer.is_active
                  ? "bg-teal-300 text-slate-950"
                  : "bg-slate-700 text-slate-200"
              }`}
            >
              {customer.is_active ? "Aktif" : "Pasif"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <span>Telefon: {customer.phone ?? "-"}</span>
            <span>E-posta: {customer.email ?? "-"}</span>
            <span>Vergi No: {customer.tax_number ?? "-"}</span>
            <span>Vergi Dairesi: {customer.tax_office ?? "-"}</span>
          </div>

          {customer.notes ? (
            <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-slate-200">
              {customer.notes}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-white/10 bg-white/5 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                activeTab === tab.key
                  ? "bg-teal-300 text-slate-950"
                  : "bg-white/10 text-slate-200 hover:bg-white/15"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <div className="space-y-4">
          <CustomerSummaryCards summary={summary} />

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">
              Genel Bilgiler
            </h3>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <Info label="Adres" value={customer.address} />
              <Info label="VarsayÄ±lan para birimi" value={customer.default_currency} />
              <Info label="VarsayÄ±lan fatura tipi" value={customer.default_invoice_type} />
              <Info label="Risk seviyesi" value={customer.risk_level} />
              <Info label="Yetkili sayÄ±sÄ±" value={String(contacts.length)} />
              <Info label="MekÃ¢n sayÄ±sÄ±" value={String(venues.length)} />
              <Info label="Hesap hareketi" value={String(ledger.length)} />
              <Info
                label="Son hareket tarihi"
                value={summary?.last_movement_date ?? "-"}
              />
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "contacts" ? (
        <CustomerContactList
          contacts={contacts}
          onCreateContact={onCreateContact}
        />
      ) : null}

      {activeTab === "venues" ? (
        <CustomerVenueList venues={venues} onCreateVenue={onCreateVenue} />
      ) : null}

      {activeTab === "ledger" ? (
        <CustomerLedger ledger={ledger} onCreateMovement={onCreateMovement} />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-800">{value || "-"}</p>
    </div>
  );
}