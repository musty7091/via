import { type ReactNode, useEffect, useState } from "react";

import type { AuthUser } from "../../../types/auth";
import MainLayout from "../../../components/MainLayout";
import { ReadOnlyBanner } from "../../../components/ReadOnlyBanner";
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
  updateCustomer,
} from "../api/customersApi";
import { CustomerDetailPanel } from "../components/CustomerDetailPanel";
import { CustomerEmptyState } from "../components/CustomerEmptyState";
import { CustomerForm } from "../components/CustomerForm";
import { CustomerSelector } from "../components/CustomerSelector";
import type {
  CustomerContactCreatePayload,
  CustomerCreatePayload,
  CustomerDetailBundle,
  CustomerLedgerMovementCreatePayload,
  CustomerLedgerSummary,
  CustomerListItem,
  CustomerUpdatePayload,
  CustomerVenueCreatePayload,
} from "../types/customerTypes";

type CustomersPageProps = {
  onBackToDashboard: () => void;
  user?: AuthUser;
  onLogout?: () => void;
  readOnly?: boolean;
};

const PAGE_SIZE = 6;
const REQUEST_LIMIT = PAGE_SIZE + 1;

export function CustomersPage({
  onBackToDashboard,
  user,
  onLogout,
  readOnly = false,
}: CustomersPageProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [customerSummaries, setCustomerSummaries] = useState<
    Record<number, CustomerLedgerSummary | null>
  >({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null
  );
  const [bundle, setBundle] = useState<CustomerDetailBundle | null>(null);
  const [search, setSearch] = useState("");
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handlePageBack() {
    if (selectedCustomerId) {
      setSelectedCustomerId(null);
      setBundle(null);
      setShowEditPanel(false);
      setIsSelectorOpen(false);
      return;
    }

    onBackToDashboard();
  }

  async function loadCustomerSummaries(nextCustomers: CustomerListItem[]) {
    const initialMap: Record<number, CustomerLedgerSummary | null> = {};

    nextCustomers.forEach((customer) => {
      initialMap[customer.id] = null;
    });

    setCustomerSummaries(initialMap);

    const results = await Promise.allSettled(
      nextCustomers.map(async (customer) => {
        const summary = await fetchCustomerLedgerSummary(customer.id);
        return {
          customerId: customer.id,
          summary,
        };
      })
    );

    const nextMap: Record<number, CustomerLedgerSummary | null> = {};

    results.forEach((result, index) => {
      const customerId = nextCustomers[index]?.id;

      if (!customerId) {
        return;
      }

      nextMap[customerId] =
        result.status === "fulfilled" ? result.value.summary : null;
    });

    setCustomerSummaries(nextMap);
  }

  async function loadCustomers(options?: {
    nextSelectedId?: number;
    nextPageIndex?: number;
    nextSearch?: string;
    keepDropdownOpen?: boolean;
  }) {
    const targetPageIndex = options?.nextPageIndex ?? pageIndex;
    const targetSearch = options?.nextSearch ?? search;

    setIsLoadingCustomers(true);
    setErrorMessage("");

    try {
      const data = await fetchCustomers({
        search: targetSearch,
        isActive: true,
        skip: targetPageIndex * PAGE_SIZE,
        limit: REQUEST_LIMIT,
      });

      const visibleCustomers = data.slice(0, PAGE_SIZE);

      setCustomers(visibleCustomers);
      setPageIndex(targetPageIndex);
      setHasNextPage(data.length > PAGE_SIZE);

      void loadCustomerSummaries(visibleCustomers);

      if (options?.nextSelectedId) {
        setSelectedCustomerId(options.nextSelectedId);
      }

      if (options?.keepDropdownOpen) {
        setIsSelectorOpen(true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Müşteri listesi alınamadı."
      );
    } finally {
      setIsLoadingCustomers(false);
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

      setCustomerSummaries((current) => ({
        ...current,
        [customerId]: summary,
      }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Müşteri detayı alınamadı."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function handleCreateCustomer(payload: CustomerCreatePayload) {
    const createdCustomer = await createCustomer(payload);
    setSearch("");
    setShowCreatePanel(false);

    await loadCustomers({
      nextSelectedId: createdCustomer.id,
      nextPageIndex: 0,
      nextSearch: "",
      keepDropdownOpen: false,
    });
  }

  async function handleUpdateCustomer(payload: CustomerUpdatePayload) {
    if (!selectedCustomerId) {
      return;
    }

    const updatedCustomer = await updateCustomer(selectedCustomerId, payload);
    setShowEditPanel(false);

    await loadCustomers({
      nextSelectedId: updatedCustomer.id,
      nextPageIndex: pageIndex,
      nextSearch: search,
      keepDropdownOpen: false,
    });

    await loadCustomerDetail(updatedCustomer.id);
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

  function handleSearchSubmit() {
    void loadCustomers({
      nextPageIndex: 0,
      nextSearch: search,
      keepDropdownOpen: true,
    });
  }

  function handleSelectCustomer(customerId: number) {
    setSelectedCustomerId(customerId);
    setIsSelectorOpen(false);
  }

  useEffect(() => {
    void loadCustomers({
      nextPageIndex: 0,
      keepDropdownOpen: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedCustomerId) {
      void loadCustomerDetail(selectedCustomerId);
    } else {
      setBundle(null);
    }
  }, [selectedCustomerId]);

  const selectedCustomerName =
    bundle?.customer.name ??
    customers.find((customer) => customer.id === selectedCustomerId)?.name ??
    null;

  return (
    <MainLayout
      userName={user?.full_name ?? "Yönetici"}
      onLogout={onLogout}
      // DİKKAT: onBack={handlePageBack} kısmını Header'da görünmemesi için iptal ettik!
    >
      <div className="flex flex-col h-auto md:h-[calc(100vh-9.5rem)] w-full">
        
        {/* SABİT BAŞLIK ALANI */}
        <div className="flex-none flex flex-col space-y-5">
          <div className="flex flex-col gap-3">
            
            {/* GERİ DÖN BUTONU - Katalog Sayfasındaki Standart Yerinde */}
            <div className="flex">
              <button
                onClick={handlePageBack}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-normal text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span aria-hidden="true">←</span> {selectedCustomerId ? "Müşteri Listesine Dön" : "Geri Dön"}
              </button>
            </div>
            
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <p className="text-xs font-normal uppercase tracking-widest text-teal-600">
                  OPERASYON MERKEZİ
                </p>
                <h1 className="mt-2 text-3xl font-normal text-slate-800">
                  Müşteri ve Mekanlar
                </h1>
                <p className="mt-2 text-sm font-normal text-slate-500 max-w-2xl">
                  Müşteri kayıtları, yetkili kişiler, mekan bilgileri ve müşteri cari hareketlerini tek alanda yönetin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePanel(true)}
                className={`rounded-full bg-slate-900 px-6 py-2.5 text-sm font-normal text-white shadow-sm transition hover:bg-slate-800 shrink-0 ${
                  readOnly ? "hidden" : ""
                }`}
              >
                Yeni Müşteri
              </button>
            </div>
            {readOnly ? <ReadOnlyBanner /> : null}
          </div>

          {errorMessage ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-normal text-red-900">
              {errorMessage}
            </div>
          ) : null}
        </div>

        {/* KAYDIRILABİLİR İÇERİK ALANI */}
        <div className="flex-1 min-h-0 mt-5 overflow-y-auto pr-2 pb-6 space-y-5">
          <CustomerSelector
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            selectedCustomerName={selectedCustomerName}
            search={search}
            pageIndex={pageIndex}
            hasNextPage={hasNextPage}
            isLoading={isLoadingCustomers}
            isOpen={isSelectorOpen}
            onToggleOpen={() => setIsSelectorOpen((value) => !value)}
            onSearchChange={setSearch}
            onSearchSubmit={handleSearchSubmit}
            onSelectCustomer={handleSelectCustomer}
            onPreviousPage={() =>
              void loadCustomers({
                nextPageIndex: Math.max(pageIndex - 1, 0),
                keepDropdownOpen: true,
              })
            }
            onNextPage={() =>
              void loadCustomers({
                nextPageIndex: pageIndex + 1,
                keepDropdownOpen: true,
              })
            }
          />

          {selectedCustomerId ? (
            <CustomerDetailPanel
              bundle={bundle}
              isLoading={isLoadingDetail}
              onOpenEditCustomer={() => setShowEditPanel(true)}
              onCreateContact={handleCreateContact}
              onCreateVenue={handleCreateVenue}
              onCreateMovement={handleCreateMovement}
            />
          ) : (
            <CustomerEmptyState
              customers={customers}
              customerSummaries={customerSummaries}
              onOpenSelector={() => setIsSelectorOpen(true)}
              onOpenCreatePanel={() => setShowCreatePanel(true)}
              onSelectCustomer={handleSelectCustomer}
            />
          )}
        </div>
      </div>

      {showCreatePanel ? (
        <CustomerModal
          eyebrow="Kayıt Paneli"
          title="Yeni Müşteri"
          onClose={() => setShowCreatePanel(false)}
        >
          <CustomerForm onCreateCustomer={handleCreateCustomer} />
        </CustomerModal>
      ) : null}

      {showEditPanel && bundle?.customer ? (
        <CustomerModal
          eyebrow="Düzenleme Paneli"
          title="Müşteri Bilgilerini Düzenle"
          onClose={() => setShowEditPanel(false)}
        >
          <CustomerForm
            initialCustomer={bundle.customer}
            eyebrow="Müşteri düzenle"
            title="Müşteri kartını güncelle"
            submitLabel="Müşteri Bilgilerini Güncelle"
            onSubmit={handleUpdateCustomer}
          />
        </CustomerModal>
      ) : null}
    </MainLayout>
  );
}

function CustomerModal({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
      <div className="flex h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-normal uppercase tracking-widest text-teal-600">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-normal text-slate-800">{title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-normal text-slate-600 transition hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}