import { useEffect, useMemo, useState } from "react";

import { ViaPageShell } from "../../../components/layout/ViaPageShell";
import {
  createArtist,
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
  updateArtist,
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
  ArtistUpdatePayload,
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
  onBackToDashboard: () => void;
};

type CatalogMode = "artists" | "services" | "packages";

const PAGE_SIZE = 7;
const REQUEST_LIMIT = PAGE_SIZE + 1;

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

  const [packageArtistOptions, setPackageArtistOptions] = useState<
    ArtistService[]
  >([]);
  const [packageServiceOptions, setPackageServiceOptions] = useState<
    TechnicalService[]
  >([]);

  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(
    null
  );

  const [riderItems, setRiderItems] = useState<RiderItem[]>([]);
  const [packageDetail, setPackageDetail] =
    useState<ServicePackageDetail | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditArtistModal, setShowEditArtistModal] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [showPackageItemModal, setShowPackageItemModal] = useState(false);
  const [removingPackageItemId, setRemovingPackageItemId] =
    useState<number | null>(null);

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

  async function loadPackageOptions() {
    try {
      const [artistOptions, serviceOptions] = await Promise.all([
        fetchArtists({ isActive: true, limit: 100 }),
        fetchTechnicalServices({ isActive: true, limit: 100 }),
      ]);

      setPackageArtistOptions(artistOptions);
      setPackageServiceOptions(serviceOptions);
    } catch {
      // Paket seçim listeleri yüklenemezse ana katalog ekranını bozmayız.
    }
  }

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
          limit: REQUEST_LIMIT,
        });

        setArtists(data.slice(0, PAGE_SIZE));
        setHasNextPage(data.length > PAGE_SIZE);

        if (options?.nextSelectedId) {
          setSelectedArtistId(options.nextSelectedId);
        }
      }

      if (targetMode === "services") {
        const data = await fetchTechnicalServices({
          search: targetSearch,
          isActive: true,
          skip: targetPageIndex * PAGE_SIZE,
          limit: REQUEST_LIMIT,
        });

        setServices(data.slice(0, PAGE_SIZE));
        setHasNextPage(data.length > PAGE_SIZE);

        if (options?.nextSelectedId) {
          setSelectedServiceId(options.nextSelectedId);
        }
      }

      if (targetMode === "packages") {
        const data = await fetchServicePackages({
          search: targetSearch,
          isActive: true,
          skip: targetPageIndex * PAGE_SIZE,
          limit: REQUEST_LIMIT,
        });

        setPackages(data.slice(0, PAGE_SIZE));
        setHasNextPage(data.length > PAGE_SIZE);

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

    await loadPackageOptions();
  }

  async function handleUpdateArtist(payload: ArtistUpdatePayload) {
    if (!selectedArtistId) {
      return;
    }

    const updated = await updateArtist(selectedArtistId, payload);

    await loadCurrentList({
      nextMode: "artists",
      nextPageIndex: pageIndex,
      nextSearch: search,
      nextSelectedId: updated.id,
    });

    await loadPackageOptions();
  }

  async function handleCreateService(payload: TechnicalServiceCreatePayload) {
    const created = await createTechnicalService(payload);

    await loadCurrentList({
      nextMode: "services",
      nextPageIndex: 0,
      nextSearch: "",
      nextSelectedId: created.id,
    });

    await loadPackageOptions();
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

  useEffect(() => {
    void loadCurrentList({
      nextMode: "artists",
      nextPageIndex: 0,
      nextSearch: "",
    });

    void loadPackageOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSelectedDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedArtistId, selectedPackageId]);

  const config = modeConfig[mode];

  return (
    <ViaPageShell
      eyebrow="Operasyon Merkezi"
      title="Hizmet Kataloğu"
      description="Sanatçı hizmetleri, teknik / operasyon hizmetleri ve program paketlerini tek katalog yapısı içinde yönetin."
      onBack={onBackToDashboard}
    >
      <div className="space-y-5">
        <div className="flex gap-2 overflow-x-auto rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm">
          {(["artists", "services", "packages"] as CatalogMode[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeMode(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                  mode === item
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {modeConfig[item].title}
              </button>
            )
          )}
        </div>

        <CatalogToolbar
          title={config.title}
          description={config.description}
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
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <CatalogList
            mode={mode}
            items={currentItems}
            selectedId={selectedId}
            onSelect={handleSelect}
          />

          <div className="min-w-0">
            {isLoadingDetail ? (
              <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
                Detay yükleniyor...
              </div>
            ) : mode === "artists" && selectedArtist ? (
              <ArtistDetail
                artist={selectedArtist}
                riderItems={riderItems}
                onOpenRiderForm={() => setShowRiderModal(true)}
                onOpenEdit={() => setShowEditArtistModal(true)}
              />
            ) : mode === "services" && selectedService ? (
              <TechnicalServiceDetail service={selectedService} />
            ) : mode === "packages" && packageDetail ? (
              <PackageDetail
                detail={packageDetail}
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

      {showEditArtistModal && selectedArtist ? (
        <ModalShell
          eyebrow="Sanatçı Hizmeti"
          title="Sanatçı Bilgilerini Düzenle"
          onClose={() => setShowEditArtistModal(false)}
        >
          <ArtistForm
            initialArtist={selectedArtist}
            submitLabel="Sanatçı Bilgilerini Güncelle"
            onSubmit={handleUpdateArtist}
            onDone={() => setShowEditArtistModal(false)}
          />
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
            artists={packageArtistOptions}
            services={packageServiceOptions}
            onSubmit={handleCreatePackageItem}
            onDone={() => setShowPackageItemModal(false)}
          />
        </ModalShell>
      ) : null}
    </ViaPageShell>
  );
}