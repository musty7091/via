import { useEffect, useMemo, useState } from "react";

import type { AuthUser } from "../../../types/auth";
import MainLayout from "../../../components/MainLayout";
import {
  createArtist,
  updateArtist,
  createArtistRiderItem,
  createPackageItem,
  createServicePackage,
  createTechnicalService,
  deletePackageItem,
  fetchArtistRiderItems,
  fetchArtists,
  fetchServicePackageDetail,
  fetchServicePackages,
  fetchTechnicalServices,
} from "../api/serviceCatalogApi";
import {
  ArtistDetail,
  PackageDetail,
  TechnicalServiceDetail,
} from "../components/CatalogDetail";
import { CatalogEmptyState } from "../components/CatalogEmptyState";
import { CatalogList } from "../components/CatalogList";
import { CatalogToolbar } from "../components/CatalogToolbar";
import {
  ArtistForm,
  ModalShell,
  PackageForm,
  PackageItemForm,
  RiderForm,
  TechnicalServiceForm,
} from "../components/CatalogForms";
import type {
  ArtistCreatePayload,
  ArtistService,
  PackageItemCreatePayload,
  RiderCreatePayload,
  RiderItem,
  ServicePackage,
  ServicePackageCreatePayload,
  ServicePackageDetail,
  TechnicalService,
  TechnicalServiceCreatePayload,
} from "../types/serviceCatalogTypes";

type ServiceCatalogPageProps = {
  onBackToDashboard?: () => void;
  user?: AuthUser;
  onLogout?: () => void;
};

type CatalogMode = "artists" | "services" | "packages";

const PAGE_SIZE = 20;

const modeConfig = {
  artists: {
    title: "Sanatçı Hizmetleri",
    description:
      "Solo sanatçı, grup, DJ, dansçı ve eşlikçi müzisyen kayıtları.",
    modeLabel: "sanatçı hizmeti",
    createTitle: "Yeni Sanatçı Hizmeti",
  },
  services: {
    title: "Teknik / Operasyon Hizmetleri",
    description:
      "Ses, ışık, sahne, ulaşım, konaklama ve operasyon destek hizmetleri.",
    modeLabel: "teknik hizmet",
    createTitle: "Yeni Teknik Hizmet",
  },
  packages: {
    title: "Program Paketleri",
    description:
      "DJ + öncü grup + ana grup + dansçı gibi müşteriye sunulacak program paketleri.",
    modeLabel: "paket",
    createTitle: "Yeni Program Paketi",
  },
};

export function ServiceCatalogPage({
  onBackToDashboard,
  user,
  onLogout
}: ServiceCatalogPageProps) {
  const [mode, setMode] = useState<CatalogMode>("artists");
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [artists, setArtists] = useState<ArtistService[]>([]);
  const [services, setServices] = useState<TechnicalService[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);

  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  const [riderItems, setRiderItems] = useState<RiderItem[]>([]);
  const [packageDetail, setPackageDetail] = useState<ServicePackageDetail | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArtistEditModal, setShowArtistEditModal] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [showPackageItemModal, setShowPackageItemModal] = useState(false);
  const [removingPackageItemId, setRemovingPackageItemId] = useState<number | null>(null);

  const currentItems = useMemo(() => {
    if (mode === "artists") {
      return artists;
    }

    if (mode === "services") {
      return services;
    }

    return packages;
  }, [artists, mode, packages, services]);

  const selectedId =
    mode === "artists"
      ? selectedArtistId
      : mode === "services"
        ? selectedServiceId
        : selectedPackageId;

  const selectedArtist =
    selectedArtistId !== null
      ? artists.find((artist) => artist.id === selectedArtistId) ?? null
      : null;

  const selectedService =
    selectedServiceId !== null
      ? services.find((service) => service.id === selectedServiceId) ?? null
      : null;

  async function loadCurrentList(options?: {
    nextMode?: CatalogMode;
    nextPageIndex?: number;
    nextSearch?: string;
    nextSelectedId?: number;
  }) {
    const targetMode = options?.nextMode ?? mode;
    const targetPageIndex = options?.nextPageIndex ?? pageIndex;
    const targetSearch = options?.nextSearch ?? search;

    setIsLoadingList(true);
    setErrorMessage("");

    try {
      if (targetMode === "artists") {
        const data = await fetchArtists({
          search: targetSearch,
          isActive: true,
          skip: targetPageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        setArtists(data);
        setHasNextPage(data.length === PAGE_SIZE);
        if (options?.nextSelectedId) {
          setSelectedArtistId(options.nextSelectedId);
        }
      }

      if (targetMode === "services") {
        const data = await fetchTechnicalServices({
          search: targetSearch,
          isActive: true,
          skip: targetPageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        setServices(data);
        setHasNextPage(data.length === PAGE_SIZE);
        if (options?.nextSelectedId) {
          setSelectedServiceId(options.nextSelectedId);
        }
      }

      if (targetMode === "packages") {
        const data = await fetchServicePackages({
          search: targetSearch,
          isActive: true,
          skip: targetPageIndex * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        setPackages(data);
        setHasNextPage(data.length === PAGE_SIZE);
        if (options?.nextSelectedId) {
          setSelectedPackageId(options.nextSelectedId);
        }
      }

      setPageIndex(targetPageIndex);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Hizmet kataloğu alınamadı."
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  async function loadSelectedDetail() {
    setIsLoadingDetail(true);
    setErrorMessage("");

    try {
      if (mode === "artists" && selectedArtistId) {
        const data = await fetchArtistRiderItems(selectedArtistId);
        setRiderItems(data);
      }

      if (mode === "packages" && selectedPackageId) {
        const detail = await fetchServicePackageDetail(selectedPackageId);
        setPackageDetail(detail);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Detay bilgisi alınamadı."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function changeMode(nextMode: CatalogMode) {
    setMode(nextMode);
    setSearch("");
    setPageIndex(0);
    setErrorMessage("");
    setPackageDetail(null);
    void loadCurrentList({
      nextMode,
      nextPageIndex: 0,
      nextSearch: "",
    });
  }

  function handleSelect(id: number) {
    if (mode === "artists") {
      setSelectedArtistId(id);
    }

    if (mode === "services") {
      setSelectedServiceId(id);
    }

    if (mode === "packages") {
      setSelectedPackageId(id);
    }
  }

  async function handleCreateArtist(payload: ArtistCreatePayload) {
    const created = await createArtist(payload);
    await loadCurrentList({
      nextMode: "artists",
      nextPageIndex: 0,
      nextSearch: "",
      nextSelectedId: created.id,
    });
  }

  async function handleCreateService(payload: TechnicalServiceCreatePayload) {
    const created = await createTechnicalService(payload);
    await loadCurrentList({
      nextMode: "services",
      nextPageIndex: 0,
      nextSearch: "",
      nextSelectedId: created.id,
    });
  }

  async function handleCreatePackage(payload: ServicePackageCreatePayload) {
    const created = await createServicePackage(payload);
    await loadCurrentList({
      nextMode: "packages",
      nextPageIndex: 0,
      nextSearch: "",
      nextSelectedId: created.id,
    });
  }

  async function handleCreateRider(payload: RiderCreatePayload) {
    if (!selectedArtistId) {
      return;
    }

    await createArtistRiderItem(selectedArtistId, payload);
    const data = await fetchArtistRiderItems(selectedArtistId);
    setRiderItems(data);
  }

  async function handleCreatePackageItem(payload: PackageItemCreatePayload) {
    if (!selectedPackageId) {
      return;
    }

    await createPackageItem(selectedPackageId, payload);
    const detail = await fetchServicePackageDetail(selectedPackageId);
    setPackageDetail(detail);
  }

  async function handleRemovePackageItem(itemId: number) {
    if (!selectedPackageId) {
      return;
    }

    const confirmed = window.confirm(
      "Bu program akışı kalemini kaldırmak istiyor musun? Kayıt tamamen silinmez, pasif hale alınır."
    );

    if (!confirmed) {
      return;
    }

    setRemovingPackageItemId(itemId);
    setErrorMessage("");

    try {
      await deletePackageItem(selectedPackageId, itemId);
      const detail = await fetchServicePackageDetail(selectedPackageId);
      setPackageDetail(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Akış kalemi kaldırılamadı."
      );
    } finally {
      setRemovingPackageItemId(null);
    }
  }

  function handleEditNotReady() {
    window.alert("Düzenleme ekranı sonraki kontrollü adımda bağlanacak.");
  }

  async function handleUpdateArtist(payload: ArtistCreatePayload) {
    if (!selectedArtistId) {
      return;
    }

    await updateArtist(selectedArtistId, payload);
    setShowArtistEditModal(false);
    await loadCurrentList({
      nextMode: "artists",
      nextPageIndex: pageIndex,
      nextSearch: search,
      nextSelectedId: selectedArtistId,
    });
    void fetchArtists({ isActive: true, limit: 100 }).then(setArtists);
  }

  useEffect(() => {
    void loadCurrentList({
      nextMode: "artists",
      nextPageIndex: 0,
      nextSearch: "",
    });
    void fetchArtists({ isActive: true, limit: 100 }).then(setArtists);
    void fetchTechnicalServices({ isActive: true, limit: 100 }).then(setServices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSelectedDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedArtistId, selectedPackageId]);

  const config = modeConfig[mode];

  return (
    <MainLayout userName={user?.full_name ?? "Yönetici"} onLogout={onLogout}>
      <div className="flex flex-col h-auto md:h-[calc(100vh-9.5rem)] w-full">
        <div className="flex-none flex flex-col space-y-5">
          <div className="flex flex-col gap-3">
            {onBackToDashboard && (
              <div className="flex">
                <button
                  onClick={onBackToDashboard}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <span aria-hidden="true">←</span> Geri Dön
                </button>
              </div>
            )}

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
                OPERASYON MERKEZİ
              </p>
              <h1 className="mt-2 text-3xl font-normal text-slate-800">
                Hizmet Kataloğu
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Sanatçı hizmetleri, teknik / operasyon hizmetleri ve program paketlerini tek katalog yapısı içinde yönetin.
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 overflow-x-auto rounded-full border border-slate-200 bg-white p-2 shadow-sm">
            {(["artists", "services", "packages"] as CatalogMode[]).map((item) => (
              <button
                key={item}
                onClick={() => changeMode(item)}
                className={`shrink-0 rounded-full px-6 py-2.5 text-sm font-medium transition-colors ${
                  mode === item
                    ? "bg-slate-900 text-white"
                    : "bg-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {modeConfig[item].title}
              </button>
            ))}
          </div>

          <CatalogToolbar
            title=""
            description=""
            search={search}
            pageIndex={pageIndex}
            hasNextPage={hasNextPage}
            isLoading={isLoadingList}
            onSearchChange={setSearch}
            onSearchSubmit={() =>
              void loadCurrentList({
                nextPageIndex: 0,
                nextSearch: search,
              })
            }
            onPreviousPage={() =>
              void loadCurrentList({
                nextPageIndex: Math.max(pageIndex - 1, 0),
              })
            }
            onNextPage={() =>
              void loadCurrentList({
                nextPageIndex: pageIndex + 1,
              })
            }
            onOpenCreate={() => setShowCreateModal(true)}
          />

          {errorMessage ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-900 shadow-sm">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <section className="flex-1 min-h-0 mt-5 grid gap-6 grid-cols-1 md:grid-cols-[390px_1fr]">
          <div className="h-full overflow-y-auto pr-2 pb-6">
            <CatalogList
              mode={mode}
              items={currentItems}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>

          <div className="h-full overflow-y-auto pr-2 pb-6">
            {isLoadingDetail ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-sm">
                Detay yükleniyor...
              </div>
            ) : mode === "artists" && selectedArtist ? (
              <ArtistDetail
                artist={selectedArtist}
                riderItems={riderItems}
                onOpenRiderForm={() => setShowRiderModal(true)}
                onOpenEdit={() => setShowArtistEditModal(true)}
              />
            ) : mode === "services" && selectedService ? (
              <TechnicalServiceDetail
                service={selectedService}
                onOpenEdit={handleEditNotReady}
              />
            ) : mode === "packages" && packageDetail ? (
              <PackageDetail
                detail={packageDetail}
                onOpenEdit={handleEditNotReady}
                onOpenItemForm={() => setShowPackageItemModal(true)}
                onRemoveItem={handleRemovePackageItem}
                removingItemId={removingPackageItemId}
              />
            ) : (
              <CatalogEmptyState
                modeLabel={config.modeLabel}
                onOpenCreate={() => setShowCreateModal(true)}
              />
            )}
          </div>
        </section>
      </div>

      {showArtistEditModal && selectedArtist ? (
        <ModalShell
          eyebrow="Hizmet Kataloğu"
          title="Sanatçı Bilgilerini Düzenle"
          onClose={() => setShowArtistEditModal(false)}
        >
          <ArtistForm
            initialArtist={selectedArtist}
            submitLabel="Değişiklikleri Kaydet"
            onSubmit={handleUpdateArtist}
            onDone={() => setShowArtistEditModal(false)}
          />
        </ModalShell>
      ) : null}

      {showCreateModal ? (
        <ModalShell
          eyebrow="Hizmet Kataloğu"
          title={config.createTitle}
          onClose={() => setShowCreateModal(false)}
        >
          {mode === "artists" ? (
            <ArtistForm
              onSubmit={handleCreateArtist}
              onDone={() => setShowCreateModal(false)}
            />
          ) : null}

          {mode === "services" ? (
            <TechnicalServiceForm
              onSubmit={handleCreateService}
              onDone={() => setShowCreateModal(false)}
            />
          ) : null}

          {mode === "packages" ? (
            <PackageForm
              onSubmit={handleCreatePackage}
              onDone={() => setShowCreateModal(false)}
            />
          ) : null}
        </ModalShell>
      ) : null}

      {showRiderModal && selectedArtistId ? (
        <ModalShell
          eyebrow="Rider Şablonu"
          title="Yeni Rider Maddesi"
          onClose={() => setShowRiderModal(false)}
        >
          <RiderForm
            onSubmit={handleCreateRider}
            onDone={() => setShowRiderModal(false)}
          />
        </ModalShell>
      ) : null}

      {showPackageItemModal && selectedPackageId ? (
        <ModalShell
          eyebrow="Program Akışı"
          title="Yeni Akış Kalemi"
          onClose={() => setShowPackageItemModal(false)}
        >
          <PackageItemForm
            artists={artists}
            services={services}
            nextSortOrder={packageDetail?.items.length ?? 0}
            onSubmit={handleCreatePackageItem}
            onDone={() => setShowPackageItemModal(false)}
          />
        </ModalShell>
      ) : null}
    </MainLayout>
  );
}