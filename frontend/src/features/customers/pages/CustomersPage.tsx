import { useEffect, useState } from "react";

import {
  createCustomer,
  createCustomerContact,
  createCustomerLedgerMovement,
  createCustomerVenue,
  fetchCustomer,
  fetchCustomerContacts,
  fetchCustomerLedger,
  fetchCustomerLedgerSummary,
  fetchCustomers,
  fetchCustomerVenues,
} from "../api/customersApi";
import { CustomerDetailPanel } from "../components/CustomerDetailPanel";
import { CustomerForm } from "../components/CustomerForm";
import { CustomerList } from "../components/CustomerList";
import type {
  CustomerContactCreatePayload,
  CustomerCreatePayload,
  CustomerDetailBundle,
  CustomerLedgerMovementCreatePayload,
  CustomerListItem,
  CustomerVenueCreatePayload,
} from "../types/customerTypes";

type CustomersPageProps = {
  onBackToDashboard: () => void;
};

export function CustomersPage({ onBackToDashboard }: CustomersPageProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );
  const [bundle, setBundle] = useState<CustomerDetailBundle | null>(null);
  const [search, setSearch] = useState("");
  const [showPassive, setShowPassive] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadCustomers(nextSelectedId?: number, forceSearch?: string) {
    setIsLoadingList(true);
    setErrorMessage("");

    try {
      const data = await fetchCustomers({
        search: forceSearch ?? search,
        isActive: showPassive ? null : true,
      });

      setCustomers(data);

      if (nextSelectedId) {
        setSelectedCustomerId(nextSelectedId);
      } else if (!selectedCustomerId && data.length > 0) {
        setSelectedCustomerId(data[0].id);
      } else if (
        selectedCustomerId &&
        !data.some((customer) => customer.id === selectedCustomerId)
      ) {
        setSelectedCustomerId(data[0]?.id ?? null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "MÃ¼ÅŸteri listesi alÄ±namadÄ±."
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadCustomerDetail(customerId: number) {
    setIsLoadingDetail(true);
    setErrorMessage("");

    try {
      const [customer, contacts, venues, ledger, summary] = await Promise.all([
        fetchCustomer(customerId),
        fetchCustomerContacts(customerId),
        fetchCustomerVenues(customerId),
        fetchCustomerLedger(customerId),
        fetchCustomerLedgerSummary(customerId),
      ]);

      setBundle({
        customer,
        contacts,
        venues,
        ledger,
        summary,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "MÃ¼ÅŸteri detayÄ± alÄ±namadÄ±."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function handleCreateCustomer(payload: CustomerCreatePayload) {
    const createdCustomer = await createCustomer(payload);
    setSearch("");
    setShowCreatePanel(false);
    await loadCustomers(createdCustomer.id, "");
  }

  async function handleCreateContact(payload: CustomerContactCreatePayload) {
    if (!selectedCustomerId) {
      return;
    }

    await createCustomerContact(selectedCustomerId, payload);
    await loadCustomerDetail(selectedCustomerId);
  }

  async function handleCreateVenue(payload: CustomerVenueCreatePayload) {
    if (!selectedCustomerId) {
      return;
    }

    await createCustomerVenue(selectedCustomerId, payload);
    await loadCustomerDetail(selectedCustomerId);
  }

  async function handleCreateMovement(
    payload: CustomerLedgerMovementCreatePayload
  ) {
    if (!selectedCustomerId) {
      return;
    }

    await createCustomerLedgerMovement(selectedCustomerId, payload);
    await loadCustomerDetail(selectedCustomerId);
  }

  useEffect(() => {
    void loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPassive]);

  useEffect(() => {
    if (selectedCustomerId) {
      void loadCustomerDetail(selectedCustomerId);
    } else {
      setBundle(null);
    }
  }, [selectedCustomerId]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-700">
              VIA EVENTS
            </p>
            <h1 className="mt-1 text-xl font-black sm:text-2xl">
              MÃ¼ÅŸteriler
            </h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCreatePanel(true)}
              className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950"
            >
              Yeni MÃ¼ÅŸteri
            </button>
            <button
              onClick={onBackToDashboard}
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 xl:grid-cols-[390px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  MÃ¼ÅŸteri Listesi
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {customers.length} kayÄ±t
                </p>
              </div>

              <button
                onClick={() => void loadCustomers()}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
              >
                Yenile
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void loadCustomers();
                    }
                  }}
                  placeholder="MÃ¼ÅŸteri ara..."
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                />

                <button
                  onClick={() => void loadCustomers()}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
                >
                  Ara
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassive}
                  onChange={(event) => setShowPassive(event.target.checked)}
                />
                Pasif mÃ¼ÅŸterileri de gÃ¶ster
              </label>
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {isLoadingList ? (
            <div className="rounded-3xl bg-white p-5 text-sm text-slate-500">
              MÃ¼ÅŸteri listesi yÃ¼kleniyor...
            </div>
          ) : (
            <CustomerList
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
            />
          )}
        </aside>

        <CustomerDetailPanel
          bundle={bundle}
          isLoading={isLoadingDetail}
          onCreateContact={handleCreateContact}
          onCreateVenue={handleCreateVenue}
          onCreateMovement={handleCreateMovement}
        />
      </section>

      {showCreatePanel ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="ml-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
                  KayÄ±t Paneli
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Yeni MÃ¼ÅŸteri
                </h2>
              </div>

              <button
                onClick={() => setShowCreatePanel(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
              >
                Kapat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <CustomerForm onCreateCustomer={handleCreateCustomer} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}