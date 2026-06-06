import { useEffect, useMemo, useState } from "react";

import {
  fetchCustomers,
  fetchEventPayments,
  fetchEvents,
  fetchPartners,
} from "../api/financeCenterApi";
import type {
  CollectionRead,
  CustomerListItem,
  EventRead,
  PartnerRead,
  PaymentPlanRead,
} from "../types/financeCenterTypes";

type CollectionRow = {
  collection: CollectionRead;
  event: EventRead;
  customer: CustomerListItem | null;
  partner: PartnerRead | null;
  paymentPlan: PaymentPlanRead | null;
};

function getCurrentPeriodMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPeriodMonthFromDate(value: string | null | undefined) {
  if (!value || value.length < 7) {
    return getCurrentPeriodMonth();
  }

  return value.slice(0, 7);
}

function formatPeriodMonth(periodMonth: string | null | undefined) {
  if (!periodMonth) {
    return "-";
  }

  const [year, month] = periodMonth.split("-");

  const monthNames: Record<string, string> = {
    "01": "Ocak",
    "02": "Şubat",
    "03": "Mart",
    "04": "Nisan",
    "05": "Mayıs",
    "06": "Haziran",
    "07": "Temmuz",
    "08": "Ağustos",
    "09": "Eylül",
    "10": "Ekim",
    "11": "Kasım",
    "12": "Aralık",
  };

  return `${monthNames[month] ?? month} ${year}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: number | string | null | undefined, currency = "TL") {
  const safeValue = Number(value ?? 0);

  return (
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue) + ` ${currency}`
  );
}

function scrollToElementById(elementId: string) {
  window.setTimeout(() => {
    document.getElementById(elementId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 80);
}

function getCollectionLocationLabel(collection: CollectionRead) {
  if (collection.is_cancelled) {
    return "İptal";
  }

  if (collection.current_location === "company") {
    return "Şirkette";
  }

  if (collection.received_by_partner_id) {
    return "Ortak Üzerinde";
  }

  return "Şirkette";
}

function getCollectionLocationClasses(collection: CollectionRead) {
  if (collection.is_cancelled) {
    return "bg-red-100 text-red-800";
  }

  if (collection.current_location === "company") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (collection.received_by_partner_id) {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-emerald-100 text-emerald-800";
}

function getPaymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash: "Nakit",
    bank: "Banka",
    card: "Kart",
    transfer: "Havale / EFT",
    cheque: "Çek",
  };

  return labels[method] ?? method;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

export function CollectionRecordsSection() {
  const currentPeriodMonth = useMemo(() => getCurrentPeriodMonth(), []);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<CollectionRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [periodFilter, setPeriodFilter] = useState(currentPeriodMonth);
  const [locationFilter, setLocationFilter] = useState<"all" | "company" | "partner">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "cancelled" | "all">("active");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadCollections() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [events, customers, partners] = await Promise.all([
        fetchEvents(),
        fetchCustomers(),
        fetchPartners(),
      ]);

      const customerMap = new Map<number, CustomerListItem>();
      customers.forEach((customer) => {
        customerMap.set(customer.id, customer);
      });

      const partnerMap = new Map<number, PartnerRead>();
      partners.forEach((partner) => {
        partnerMap.set(partner.id, partner);
      });

      const paymentResults = await Promise.allSettled(
        events.map(async (eventItem) => {
          const detail = await fetchEventPayments(eventItem.id);

          return {
            eventItem,
            detail,
          };
        })
      );

      const loadedRows: CollectionRow[] = [];

      paymentResults.forEach((result) => {
        if (result.status !== "fulfilled") {
          return;
        }

        const { eventItem, detail } = result.value;
        const planMap = new Map<number, PaymentPlanRead>();

        detail.payment_plans.forEach((plan) => {
          planMap.set(plan.id, plan);
        });

        detail.collections.forEach((collection) => {
          loadedRows.push({
            collection,
            event: eventItem,
            customer: customerMap.get(collection.customer_id) ?? null,
            partner: collection.received_by_partner_id
              ? partnerMap.get(collection.received_by_partner_id) ?? null
              : null,
            paymentPlan: collection.payment_plan_id
              ? planMap.get(collection.payment_plan_id) ?? null
              : null,
          });
        });
      });

      loadedRows.sort((left, right) => {
        const dateCompare = right.collection.collection_date.localeCompare(
          left.collection.collection_date
        );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return right.collection.id - left.collection.id;
      });

      setRows(loadedRows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Tahsilat kayıtları alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCollections();
  }, []);

  const periodOptions = useMemo(() => {
    const periods = new Set<string>();

    rows.forEach((row) => {
      periods.add(getPeriodMonthFromDate(row.collection.collection_date));
    });

    periods.add(currentPeriodMonth);

    return Array.from(periods).sort().reverse();
  }, [rows, currentPeriodMonth]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      const collectionPeriod = getPeriodMonthFromDate(row.collection.collection_date);

      const matchesPeriod = periodFilter === "all" || collectionPeriod === periodFilter;

      const matchesLocation =
        locationFilter === "all" ||
        (locationFilter === "company" && row.collection.current_location === "company") ||
        (locationFilter === "partner" &&
          row.collection.received_by_partner_id !== null &&
          row.collection.current_location !== "company");

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !row.collection.is_cancelled) ||
        (statusFilter === "cancelled" && row.collection.is_cancelled);

      const searchableText = [
        row.customer?.name,
        row.customer?.short_name,
        row.event.title,
        row.event.event_code,
        row.partner?.full_name,
        row.paymentPlan?.title,
        row.collection.document_no,
        row.collection.notes,
        row.collection.payment_method,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const matchesSearch =
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);

      return matchesPeriod && matchesLocation && matchesStatus && matchesSearch;
    });
  }, [rows, periodFilter, locationFilter, statusFilter, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const visibleRows = filteredRows.slice(pageStartIndex, pageStartIndex + pageSize);

  const activeRows = filteredRows.filter((row) => !row.collection.is_cancelled);
  const cancelledRows = filteredRows.filter((row) => row.collection.is_cancelled);
  const activeTotal = activeRows.reduce(
    (total, row) => total + Number(row.collection.base_amount ?? 0),
    0
  );
  const partnerTotal = activeRows
    .filter(
      (row) =>
        row.collection.received_by_partner_id !== null &&
        row.collection.current_location !== "company"
    )
    .reduce((total, row) => total + Number(row.collection.base_amount ?? 0), 0);

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  function changePeriodFilter(value: string) {
    setPeriodFilter(value);
    resetToFirstPage();
  }

  function changeLocationFilter(value: "all" | "company" | "partner") {
    setLocationFilter(value);
    resetToFirstPage();
  }

  function changeStatusFilter(value: "active" | "cancelled" | "all") {
    setStatusFilter(value);
    resetToFirstPage();
  }

  function changeSearchText(value: string) {
    setSearchText(value);
    resetToFirstPage();
  }

  function changePageSize(value: number) {
    setPageSize(value);
    resetToFirstPage();
  }

  return (
    <section id="finance-collection-records-section" className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Tahsilat Kayıtları
          </p>
          <h3 className="mt-1 text-2xl font-black">Tahsilat takip ekranı</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Müşteriden alınan tahsilatlar, paranın şirkette mi ortakta mı olduğu ve iptal
            durumu ile izlenir.
          </p>
        </div>
        <div className="rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-right text-slate-950">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
            Filtrelenmiş Aktif Toplam
          </p>
          <p className="text-lg font-black">{formatMoney(activeTotal)}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const nextIsOpen = !isOpen;
            setIsOpen(nextIsOpen);

            if (nextIsOpen) {
              scrollToElementById("finance-collection-records-section");
            }
          }}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
        >
          {isOpen ? "Kapat ▲" : "Detayı Aç ▼"}
        </button>
      </div>

      {isOpen ? (
        <>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniMetric title="Filtrelenmiş Kayıt" value={String(filteredRows.length)} />
        <MiniMetric
          title="Aktif / İptal"
          value={`${activeRows.length} / ${cancelledRows.length}`}
        />
        <MiniMetric title="Ortakta Bekleyen" value={formatMoney(partnerTotal)} />
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1.4fr_0.8fr]">
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Ay
          </span>
          <select
            value={periodFilter}
            onChange={(event) => changePeriodFilter(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
          >
            <option value="all">Tüm Aylar</option>
            {periodOptions.map((period) => (
              <option key={period} value={period}>
                {formatPeriodMonth(period)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Para Durumu
          </span>
          <select
            value={locationFilter}
            onChange={(event) =>
              changeLocationFilter(event.target.value as "all" | "company" | "partner")
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
          >
            <option value="all">Tümü</option>
            <option value="company">Şirkette</option>
            <option value="partner">Ortak Üzerinde</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Durum
          </span>
          <select
            value={statusFilter}
            onChange={(event) =>
              changeStatusFilter(event.target.value as "active" | "cancelled" | "all")
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
          >
            <option value="active">Aktif</option>
            <option value="cancelled">İptal Edilen</option>
            <option value="all">Tümü</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Arama
          </span>
          <input
            value={searchText}
            onChange={(event) => changeSearchText(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
            placeholder="Müşteri, etkinlik, belge no ara"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Sayfa
          </span>
          <select
            value={pageSize}
            onChange={(event) => changePageSize(Number(event.target.value))}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
          >
            <option value={5}>5 kayıt</option>
            <option value={10}>10 kayıt</option>
            <option value={20}>20 kayıt</option>
            <option value={50}>50 kayıt</option>
          </select>
        </label>
      </div>

      {loadError ? (
        <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
          {loadError}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold text-slate-500">
          Tahsilat kayıtları yükleniyor...
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {!isLoading && visibleRows.length === 0 ? (
          <EmptyState text="Bu filtrelere uygun tahsilat kaydı bulunmuyor." />
        ) : null}

        {visibleRows.map((row) => (
          <div
            key={row.collection.id}
            className={`rounded-[1.25rem] border p-4 ${
              row.collection.is_cancelled
                ? "border-red-100 bg-red-50"
                : "border-slate-100 bg-slate-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{row.customer?.name ?? "Müşteri bulunamadı"}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${getCollectionLocationClasses(
                      row.collection
                    )}`}
                  >
                    {getCollectionLocationLabel(row.collection)}
                  </span>
                  {row.partner ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
                      {row.partner.full_name}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-bold text-slate-600">{row.event.title}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {formatDate(row.collection.collection_date)} ·{" "}
                  {getPaymentMethodLabel(row.collection.payment_method)}
                  {row.collection.document_no ? ` · Belge: ${row.collection.document_no}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black">
                  {formatMoney(row.collection.base_amount, row.collection.currency)}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedRow(row)}
                  className="mt-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm"
                >
                  Detay Aç
                </button>
              </div>
            </div>

            {row.paymentPlan ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Ödeme planı: <strong>{row.paymentPlan.title}</strong>
              </p>
            ) : null}

            {row.collection.is_cancelled ? (
              <p className="mt-3 text-sm leading-6 text-red-700">
                İptal nedeni: {row.collection.cancellation_reason ?? "Belirtilmemiş"}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-500">
          Sayfa {safeCurrentPage} / {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
            disabled={safeCurrentPage <= 1}
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-40"
          >
            Önceki
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
      </div>

        </>
      ) : null}

      {selectedRow ? (
        <CollectionDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      ) : null}
    </section>
  );
}

function CollectionDetailModal({
  row,
  onClose,
}: {
  row: CollectionRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Tahsilat Detayı
            </p>
            <h3 className="mt-2 text-2xl font-black">
              {row.customer?.name ?? "Müşteri bulunamadı"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{row.event.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">
            Tahsilat Tutarı
          </p>
          <p className="mt-2 text-3xl font-black">
            {formatMoney(row.collection.base_amount, row.collection.currency)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {formatDate(row.collection.collection_date)} ·{" "}
            {getPaymentMethodLabel(row.collection.payment_method)}
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <DetailBox title="Para Durumu" value={getCollectionLocationLabel(row.collection)} />
          <DetailBox title="Tahsilatı Alan Ortak" value={row.partner?.full_name ?? "-"} />
          <DetailBox title="Ödeme Planı" value={row.paymentPlan?.title ?? "-"} />
          <DetailBox title="Belge No" value={row.collection.document_no ?? "-"} />
          <DetailBox title="Etkinlik Kodu" value={row.event.event_code ?? "-"} />
          <DetailBox title="Durum" value={row.collection.is_cancelled ? "İptal" : "Aktif"} />
        </div>

        {row.collection.notes ? (
          <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-700">Not</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{row.collection.notes}</p>
          </div>
        ) : null}

        {row.collection.is_cancelled ? (
          <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-red-950">
            <p className="font-black">İptal Bilgisi</p>
            <p className="mt-2 text-sm leading-6">
              {row.collection.cancellation_reason ?? "İptal nedeni belirtilmemiş."}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className="mt-2 font-black text-slate-950">{value}</p>
    </div>
  );
}
