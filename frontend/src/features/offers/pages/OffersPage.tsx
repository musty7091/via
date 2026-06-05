import { useEffect, useState } from "react";

import {
  cancelOffer,
  convertOfferToAgreement,
  createOffer,
  createOfferItem,
  deleteOfferItem,
  fetchCustomers,
  fetchCustomerVenues,
  fetchOfferDetail,
  fetchOfferPrintView,
  fetchOffers,
  fetchPackages,
  importPackageToOffer,
  updateOffer,
} from "../api/offersApi";
import { OfferDetailPanel } from "../components/OfferDetailPanel";
import { OfferEmptyState } from "../components/OfferEmptyState";
import {
  ModalShell,
  OfferForm,
  OfferItemForm,
} from "../components/OfferForms";
import { OfferList } from "../components/OfferList";
import { OfferToolbar } from "../components/OfferToolbar";
import { openOfferPrintWindow } from "../components/offerPrint";
import type {
  CustomerOption,
  OfferCreatePayload,
  OfferDetail,
  OfferItemCreatePayload,
  OfferListItem,
  OfferUpdatePayload,
  PackageOption,
  VenueOption,
} from "../types/offerTypes";

type OffersPageProps = {
  onBackToDashboard: () => void;
};

const PAGE_SIZE = 20;

export function OffersPage({ onBackToDashboard }: OffersPageProps) {
  const [offers, setOffers] = useState<OfferListItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);

  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [offerDetail, setOfferDetail] = useState<OfferDetail | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  async function loadOffers(options?: {
    nextPageIndex?: number;
    nextSearch?: string;
    nextStatusFilter?: string;
    nextSelectedOfferId?: number;
  }) {
    const targetPageIndex = options?.nextPageIndex ?? pageIndex;
    const targetSearch = options?.nextSearch ?? search;
    const targetStatusFilter = options?.nextStatusFilter ?? statusFilter;

    setIsLoadingList(true);
    setErrorMessage("");

    try {
      const data = await fetchOffers({
        search: targetSearch,
        status: targetStatusFilter || null,
        skip: targetPageIndex * PAGE_SIZE,
        limit: PAGE_SIZE,
      });

      setOffers(data);
      setPageIndex(targetPageIndex);
      setHasNextPage(data.length === PAGE_SIZE);

      if (options?.nextSelectedOfferId) {
        setSelectedOfferId(options.nextSelectedOfferId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Teklif listesi alınamadı."
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadOfferDetail(offerId: number) {
    setIsLoadingDetail(true);
    setErrorMessage("");

    try {
      const detail = await fetchOfferDetail(offerId);
      setOfferDetail(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Teklif detayı alınamadı."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function loadCustomerVenues(customerId: number | null) {
    if (!customerId) {
      setVenues([]);
      return;
    }

    try {
      const data = await fetchCustomerVenues(customerId);
      setVenues(data);
    } catch {
      setVenues([]);
    }
  }

  async function handleCreateOffer(
    payload: OfferCreatePayload,
    packageId: number | null
  ) {
    const created = await createOffer(payload);

    if (packageId) {
      await importPackageToOffer(created.id, packageId, true);
    }

    await loadOffers({
      nextPageIndex: 0,
      nextSearch: "",
      nextSelectedOfferId: created.id,
    });
    await loadOfferDetail(created.id);
  }

  async function handleUpdateOffer(
    payload: OfferCreatePayload,
    packageId: number | null
  ) {
    if (!selectedOfferId || !offerDetail) {
      return;
    }

    const updatePayload: OfferUpdatePayload = payload;
    const previousPackageId = offerDetail.offer.package_id;

    const updated = await updateOffer(selectedOfferId, updatePayload);

    if (packageId && packageId !== previousPackageId) {
      await importPackageToOffer(updated.id, packageId, true);
    }

    await loadOffers({
      nextPageIndex: pageIndex,
      nextSearch: search,
      nextSelectedOfferId: updated.id,
    });
    await loadOfferDetail(updated.id);
  }

  async function handleCreateOfferItem(payload: OfferItemCreatePayload) {
    if (!selectedOfferId) {
      return;
    }

    await createOfferItem(selectedOfferId, payload);
    await loadOfferDetail(selectedOfferId);
  }

  async function handleRemoveItem(itemId: number) {
    if (!selectedOfferId) {
      return;
    }

    const confirmed = window.confirm(
      "Bu teklif kalemini kaldırmak istiyor musun? Kayıt tamamen silinmez, pasif hale alınır."
    );

    if (!confirmed) {
      return;
    }

    setRemovingItemId(itemId);
    setErrorMessage("");

    try {
      await deleteOfferItem(selectedOfferId, itemId);
      await loadOfferDetail(selectedOfferId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Teklif kalemi kaldırılamadı."
      );
    } finally {
      setRemovingItemId(null);
    }
  }

  async function handleCancelOffer() {
    if (!selectedOfferId) {
      return;
    }

    const confirmed = window.confirm(
      "Bu teklif iptal edilecek. Kayıt tamamen silinmeyecek, sadece iptal durumuna alınacak. Devam etmek istiyor musun?"
    );

    if (!confirmed) {
      return;
    }

    setIsCancelling(true);
    setErrorMessage("");

    try {
      await cancelOffer(selectedOfferId);
      setSelectedOfferId(null);
      setOfferDetail(null);
      await loadOffers({
        nextPageIndex: 0,
        nextSearch: search,
        nextStatusFilter: statusFilter,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Teklif iptal edilemedi."
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleConvertToAgreement() {
    if (!selectedOfferId) {
      return;
    }

    const confirmed = window.confirm(
      "Bu teklifi anlaşmaya çevirmek istiyor musun?"
    );

    if (!confirmed) {
      return;
    }

    setIsConverting(true);
    setErrorMessage("");

    try {
      await convertOfferToAgreement(selectedOfferId, "Müşteri onayı ile anlaşmaya çevrildi.");
      await loadOffers();
      await loadOfferDetail(selectedOfferId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Teklif anlaşmaya çevrilemedi."
      );
    } finally {
      setIsConverting(false);
    }
  }

  async function handlePrint() {
    if (!selectedOfferId) {
      return;
    }

    try {
      const view = await fetchOfferPrintView(selectedOfferId);
      openOfferPrintWindow(view);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Print görünümü alınamadı."
      );
    }
  }

  useEffect(() => {
    void loadOffers({
      nextPageIndex: 0,
      nextSearch: "",
      nextStatusFilter: "",
    });
    void fetchCustomers({ isActive: true, limit: 200 }).then(setCustomers);
    void fetchPackages({ isActive: true, limit: 200 }).then(setPackages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedOfferId) {
      void loadOfferDetail(selectedOfferId);
    } else {
      setOfferDetail(null);
    }
  }, [selectedOfferId]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="min-w-0">
            <img src="/brand/via-logo-horizontal.png" alt="VIA EVENTS" className="h-5 w-auto object-contain" />
            <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">
              Teklif ve Anlaşma
            </h1>
          </div>

          <button
            onClick={onBackToDashboard}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
          >
            Dashboard
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        <OfferToolbar
          search={search}
          statusFilter={statusFilter}
          pageIndex={pageIndex}
          hasNextPage={hasNextPage}
          isLoading={isLoadingList}
          onSearchChange={setSearch}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            void loadOffers({
              nextPageIndex: 0,
              nextSearch: search,
              nextStatusFilter: value,
            });
          }}
          onSearchSubmit={() =>
            void loadOffers({
              nextPageIndex: 0,
              nextSearch: search,
              nextStatusFilter: statusFilter,
            })
          }
          onPreviousPage={() =>
            void loadOffers({
              nextPageIndex: Math.max(pageIndex - 1, 0),
              nextStatusFilter: statusFilter,
            })
          }
          onNextPage={() =>
            void loadOffers({
              nextPageIndex: pageIndex + 1,
              nextStatusFilter: statusFilter,
            })
          }
          onOpenCreate={() => setShowCreateModal(true)}
        />

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
          <div>
            {isLoadingList ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Teklifler yükleniyor...
              </div>
            ) : (
              <OfferList
                offers={offers}
                selectedOfferId={selectedOfferId}
                onSelectOffer={setSelectedOfferId}
              />
            )}
          </div>

          <div>
            {isLoadingDetail ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Detay yükleniyor...
              </div>
            ) : offerDetail ? (
              <OfferDetailPanel
                detail={offerDetail}
                onOpenItemForm={() => setShowItemModal(true)}
                onOpenEdit={() => setShowEditModal(true)}
                onRemoveItem={handleRemoveItem}
                onPrint={handlePrint}
                onConvertToAgreement={handleConvertToAgreement}
                onCancelOffer={handleCancelOffer}
                removingItemId={removingItemId}
                isConverting={isConverting}
                isCancelling={isCancelling}
              />
            ) : (
              <OfferEmptyState onOpenCreate={() => setShowCreateModal(true)} />
            )}
          </div>
        </section>
      </section>

      {showCreateModal ? (
        <ModalShell
          eyebrow="Teklif"
          title="Yeni Teklif Oluştur"
          onClose={() => setShowCreateModal(false)}
        >
          <OfferForm
            customers={customers}
            venues={venues}
            packages={packages}
            onCustomerChange={loadCustomerVenues}
            onSubmit={handleCreateOffer}
            onDone={() => setShowCreateModal(false)}
          />
        </ModalShell>
      ) : null}

      {showEditModal && offerDetail ? (
        <ModalShell
          eyebrow="Teklif"
          title="Teklifi Düzenle"
          onClose={() => setShowEditModal(false)}
        >
          <OfferForm
            customers={customers}
            venues={venues}
            packages={packages}
            initialOffer={offerDetail.offer}
            submitLabel="Değişiklikleri Kaydet"
            onCustomerChange={loadCustomerVenues}
            onSubmit={handleUpdateOffer}
            onDone={() => setShowEditModal(false)}
          />
        </ModalShell>
      ) : null}

      {showItemModal && selectedOfferId ? (
        <ModalShell
          eyebrow="Teklif Kalemi"
          title="Manuel Kalem Ekle"
          onClose={() => setShowItemModal(false)}
        >
          <OfferItemForm
            onSubmit={handleCreateOfferItem}
            onDone={() => setShowItemModal(false)}
          />
        </ModalShell>
      ) : null}
    </main>
  );
}
