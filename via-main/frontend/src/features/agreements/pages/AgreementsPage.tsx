import { useEffect, useState } from "react";

import { ViaPageShell } from "../../../components/layout/ViaPageShell";
import { ReadOnlyBanner } from "../../../components/ReadOnlyBanner";
import { openOfferPrintWindow } from "../../offers/components/offerPrint";
import {
  fetchAgreementCustomers,
  fetchAgreementDetail,
  fetchAgreementPrintView,
  fetchAgreements,
  fetchAgreementVenues,
} from "../api/agreementsApi";
import { AgreementDetailPanel } from "../components/AgreementDetailPanel";
import { AgreementList } from "../components/AgreementList";
import type {
  AgreementCustomerMap,
  AgreementDetail,
  AgreementListItem,
  AgreementVenueMap,
} from "../types/agreementTypes";

type AgreementsPageProps = {
  onBackToDashboard: () => void;
  onOpenEvents: () => void;
  readOnly?: boolean;
};

const PAGE_SIZE = 5;
const REQUEST_LIMIT = PAGE_SIZE + 1;

export function AgreementsPage({
  onBackToDashboard,
  onOpenEvents,
  readOnly = false,
}: AgreementsPageProps) {
  const [agreements, setAgreements] = useState<AgreementListItem[]>([]);
  const [selectedAgreementId, setSelectedAgreementId] = useState<number | null>(
    null
  );
  const [agreementDetail, setAgreementDetail] =
    useState<AgreementDetail | null>(null);

  const [customerMap, setCustomerMap] = useState<AgreementCustomerMap>({});
  const [venueMap, setVenueMap] = useState<AgreementVenueMap>({});

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function handlePageBack() {
    if (selectedAgreementId) {
      setSelectedAgreementId(null);
      setAgreementDetail(null);
      return;
    }

    onBackToDashboard();
  }

  async function loadAgreements(options?: {
    nextPageIndex?: number;
    nextSearch?: string;
    nextSelectedAgreementId?: number;
  }) {
    const targetPageIndex = options?.nextPageIndex ?? pageIndex;
    const targetSearch = options?.nextSearch ?? search;

    setIsLoadingList(true);
    setErrorMessage("");

    try {
      const data = await fetchAgreements({
        search: targetSearch,
        skip: targetPageIndex * PAGE_SIZE,
        limit: REQUEST_LIMIT,
      });

      setAgreements(data.slice(0, PAGE_SIZE));
      setPageIndex(targetPageIndex);
      setHasNextPage(data.length > PAGE_SIZE);

      if (options?.nextSelectedAgreementId) {
        setSelectedAgreementId(options.nextSelectedAgreementId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Anlaşma listesi alınamadı."
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadAgreementDetail(agreementId: number) {
    setIsLoadingDetail(true);
    setErrorMessage("");

    try {
      const detail = await fetchAgreementDetail(agreementId);
      setAgreementDetail(detail);

      if (detail.offer.customer_id) {
        try {
          const venues = await fetchAgreementVenues(detail.offer.customer_id);

          setVenueMap((current) => {
            const next = { ...current };

            venues.forEach((venue) => {
              next[venue.id] = venue;
            });

            return next;
          });
        } catch {
          // Mekan bilgisi alınamazsa detay yine açılır.
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Anlaşma detayı alınamadı."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  async function handlePrint() {
    if (!selectedAgreementId) {
      return;
    }

    try {
      const view = await fetchAgreementPrintView(selectedAgreementId);

      openOfferPrintWindow(view, {
        documentType: "agreement",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Anlaşma çıktısı alınamadı."
      );
    }
  }

  function handleOpenEventFile() {
    onOpenEvents();
  }

  useEffect(() => {
    void loadAgreements({
      nextPageIndex: 0,
      nextSearch: "",
    });

    void fetchAgreementCustomers()
      .then((customers) => {
        const nextMap: AgreementCustomerMap = {};

        customers.forEach((customer) => {
          nextMap[customer.id] = customer;
        });

        setCustomerMap(nextMap);
      })
      .catch(() => setCustomerMap({}));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedAgreementId) {
      void loadAgreementDetail(selectedAgreementId);
    } else {
      setAgreementDetail(null);
    }
  }, [selectedAgreementId]);

  return (
    <ViaPageShell
      eyebrow="Operasyon Merkezi"
      title="Anlaşmalar"
      description="Anlaşmaya çevrilmiş teklifleri, bağlı etkinlik dosyalarını ve finans özetlerini takip edin."
      onBack={handlePageBack}
      backLabel={selectedAgreementId ? "Anlaşma Listesine Dön" : "Geri Dön"}
    >
      <div className="space-y-5">
        {readOnly ? <ReadOnlyBanner /> : null}
        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void loadAgreements({
                    nextPageIndex: 0,
                    nextSearch: search,
                  });
                }
              }}
              placeholder="Anlaşma no, teklif no veya başlık ara..."
              className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-emerald-500 transition focus:ring-4"
            />

            <button
              type="button"
              onClick={() =>
                void loadAgreements({
                  nextPageIndex: 0,
                  nextSearch: search,
                })
              }
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Ara
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">
            <button
              type="button"
              disabled={pageIndex === 0 || isLoadingList}
              onClick={() =>
                void loadAgreements({
                  nextPageIndex: Math.max(pageIndex - 1, 0),
                  nextSearch: search,
                })
              }
              className="rounded-full bg-slate-100 px-3 py-2 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Önceki
            </button>

            <span className="rounded-full bg-slate-50 px-3 py-2 text-slate-500">
              Sayfa {pageIndex + 1} • 5 kayıt / sayfa
            </span>

            <button
              type="button"
              disabled={!hasNextPage || isLoadingList}
              onClick={() =>
                void loadAgreements({
                  nextPageIndex: pageIndex + 1,
                  nextSearch: search,
                })
              }
              className="rounded-full bg-slate-100 px-3 py-2 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sonraki →
            </button>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <div>
            {isLoadingList ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Anlaşmalar yükleniyor...
              </div>
            ) : (
              <AgreementList
                agreements={agreements}
                selectedAgreementId={selectedAgreementId}
                customerMap={customerMap}
                onSelectAgreement={setSelectedAgreementId}
              />
            )}
          </div>

          <div className="min-w-0">
            {isLoadingDetail ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Detay yükleniyor...
              </div>
            ) : agreementDetail ? (
              <AgreementDetailPanel
                detail={agreementDetail}
                customerMap={customerMap}
                venueMap={venueMap}
                onPrint={handlePrint}
                onOpenEventFile={handleOpenEventFile}
              />
            ) : (
              <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-black text-slate-950">
                  Anlaşma seçilmedi.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sol listeden bir anlaşma seçtiğinizde detay, finans ve
                  etkinlik bağlantısı burada açılır.
                </p>
              </section>
            )}
          </div>
        </section>
      </div>
    </ViaPageShell>
  );
}