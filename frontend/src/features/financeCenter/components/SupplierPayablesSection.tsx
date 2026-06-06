import { useEffect, useMemo, useState } from "react";

import { fetchArtists, fetchEvents, fetchServiceItems, fetchSupplierPayables } from "../api/financeCenterApi";
import type { ArtistRead, EventRead, ServiceItemRead, SupplierPayableRead } from "../types/financeCenterTypes";

type SupplierPayableRow = {
  payable: SupplierPayableRead;
  event: EventRead;
  supplierName: string;
  supplierTypeLabel: string;
};

type SupplierPayablesSectionProps = {
  refreshKey?: number;
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

function getPayableStatusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Açık",
    partial: "Kısmi Ödendi",
    paid: "Ödendi",
    cancelled: "İptal",
  };
  return labels[status] ?? status;
}

function getPayableStatusClass(status: string) {
  if (status === "paid") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "partial") {
    return "bg-amber-100 text-amber-800";
  }
  if (status === "cancelled") {
    return "bg-red-100 text-red-800";
  }
  return "bg-slate-100 text-slate-700";
}

export function SupplierPayablesSection({ refreshKey = 0 }: SupplierPayablesSectionProps) {
  const currentPeriodMonth = useMemo(() => getCurrentPeriodMonth(), []);
  const [rows, setRows] = useState<SupplierPayableRow[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState<"all" | "artist" | "service">("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "partial" | "paid" | "all">("open");
  const [searchText, setSearchText] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadPayables() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [events, artists, services] = await Promise.all([
        fetchEvents(),
        fetchArtists(),
        fetchServiceItems(),
      ]);

      const artistMap = new Map<number, ArtistRead>();
      artists.forEach((artist) => artistMap.set(artist.id, artist));

      const serviceMap = new Map<number, ServiceItemRead>();
      services.forEach((service) => serviceMap.set(service.id, service));

      const results = await Promise.allSettled(
        events.map(async (eventItem) => ({
          eventItem,
          detail: await fetchSupplierPayables(eventItem.id),
        }))
      );

      const loadedRows: SupplierPayableRow[] = [];

      results.forEach((result) => {
        if (result.status !== "fulfilled") {
          return;
        }

        const { eventItem, detail } = result.value;

        detail.payables.forEach((payable) => {
          const isArtist = payable.artist_id !== null;
          const supplierName = isArtist
            ? artistMap.get(payable.artist_id ?? 0)?.name ?? `Sanatçı #${payable.artist_id}`
            : serviceMap.get(payable.service_item_id ?? 0)?.name ??
              `Hizmet #${payable.service_item_id}`;

          loadedRows.push({
            payable,
            event: eventItem,
            supplierName,
            supplierTypeLabel: isArtist ? "Sanatçı" : "Hizmet",
          });
        });
      });

      loadedRows.sort((left, right) => {
        const leftDate = left.payable.due_date ?? left.event.event_date ?? "";
        const rightDate = right.payable.due_date ?? right.event.event_date ?? "";
        const dateCompare = rightDate.localeCompare(leftDate);
        return dateCompare !== 0 ? dateCompare : right.payable.id - left.payable.id;
      });

      setRows(loadedRows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Sanatçı/hizmet borçları alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPayables();
  }, [refreshKey]);

  const periodOptions = useMemo(() => {
    const periods = new Set<string>();
    rows.forEach((row) => periods.add(getPeriodMonthFromDate(row.payable.due_date ?? row.event.event_date)));
    periods.add(currentPeriodMonth);
    return Array.from(periods).sort().reverse();
  }, [rows, currentPeriodMonth]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      const period = getPeriodMonthFromDate(row.payable.due_date ?? row.event.event_date);
      const matchesPeriod = periodFilter === "all" || period === periodFilter;
      const matchesSupplierType =
        supplierFilter === "all" ||
        (supplierFilter === "artist" && row.payable.artist_id !== null) ||
        (supplierFilter === "service" && row.payable.service_item_id !== null);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "open" && (row.payable.status === "open" || row.payable.status === "partial")) ||
        row.payable.status === statusFilter;
      const searchableText = [
        row.supplierName,
        row.supplierTypeLabel,
        row.event.title,
        row.event.event_code,
        row.payable.title,
        row.payable.description,
        row.payable.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      const matchesSearch = normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);

      return matchesPeriod && matchesSupplierType && matchesStatus && matchesSearch;
    });
  }, [rows, periodFilter, supplierFilter, statusFilter, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const visibleRows = filteredRows.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const openRows = filteredRows.filter((row) => row.payable.status === "open" || row.payable.status === "partial");
  const paidRows = filteredRows.filter((row) => row.payable.status === "paid");
  const remainingTotal = openRows.reduce((total, row) => total + Number(row.payable.remaining_base_amount ?? 0), 0);
  const paidTotal = filteredRows.reduce((total, row) => total + Number(row.payable.paid_base_amount ?? 0), 0);

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  return (
    <section id="finance-supplier-payables-section" className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Sanatçı / Hizmet Borçları
          </p>
          <h3 className="mt-1 text-2xl font-black">Borç takip ekranı</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Bu bölüm ödeme yapmak için değil, sanatçı ve hizmet borçlarının güncel durumunu
            takip etmek için kullanılır. Ödeme işlemi üstteki Hızlı İşlemler alanından başlatılır.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-start justify-end gap-3">
          {isOpen ? (
            <div className="rounded-[1.25rem] border border-rose-100 bg-rose-50 px-4 py-3 text-right text-slate-950">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
                Açık Borç
              </p>
              <p className="text-lg font-black">{formatMoney(remainingTotal)}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const nextIsOpen = !isOpen;
              setIsOpen(nextIsOpen);
              if (nextIsOpen) {
                scrollToElementById("finance-supplier-payables-section");
              }
            }}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            {isOpen ? "Kapat ▲" : "Detayı Aç ▼"}
          </button>
        </div>
      </div>

      {isOpen ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Metric title="Açık/Kısmi Borç" value={String(openRows.length)} />
            <Metric title="Ödenmiş Kayıt" value={String(paidRows.length)} />
            <Metric title="Ödenen Toplam" value={formatMoney(paidTotal)} />
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1.4fr_0.8fr]">
            <SelectField label="Ay" value={periodFilter} onChange={(value) => { setPeriodFilter(value); resetToFirstPage(); }}>
              <option value="all">Tüm Aylar</option>
              {periodOptions.map((period) => (
                <option key={period} value={period}>{formatPeriodMonth(period)}</option>
              ))}
            </SelectField>

            <SelectField label="Tür" value={supplierFilter} onChange={(value) => { setSupplierFilter(value as "all" | "artist" | "service"); resetToFirstPage(); }}>
              <option value="all">Tümü</option>
              <option value="artist">Sanatçı</option>
              <option value="service">Hizmet</option>
            </SelectField>

            <SelectField label="Durum" value={statusFilter} onChange={(value) => { setStatusFilter(value as "open" | "partial" | "paid" | "all"); resetToFirstPage(); }}>
              <option value="open">Açık + Kısmi</option>
              <option value="partial">Kısmi Ödendi</option>
              <option value="paid">Ödendi</option>
              <option value="all">Tümü</option>
            </SelectField>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Arama
              </span>
              <input
                value={searchText}
                onChange={(event) => { setSearchText(event.target.value); resetToFirstPage(); }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-rose-300"
                placeholder="Sanatçı, hizmet, etkinlik ara"
              />
            </label>

            <SelectField label="Sayfa" value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); resetToFirstPage(); }}>
              <option value={5}>5 kayıt</option>
              <option value={10}>10 kayıt</option>
              <option value={20}>20 kayıt</option>
              <option value={50}>50 kayıt</option>
            </SelectField>
          </div>

          {loadError ? (
            <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
              {loadError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold text-slate-500">
              Sanatçı/hizmet borçları yükleniyor...
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {!isLoading && visibleRows.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                Bu filtrelere uygun sanatçı/hizmet borcu bulunmuyor.
              </div>
            ) : null}

            {visibleRows.map((row) => (
              <div key={row.payable.id} className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">{row.supplierName}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                        {row.supplierTypeLabel}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${getPayableStatusClass(row.payable.status)}`}>
                        {getPayableStatusLabel(row.payable.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-600">{row.event.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {row.payable.title}
                      {row.payable.due_date ? ` · Vade: ${formatDate(row.payable.due_date)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black">
                      {formatMoney(row.payable.remaining_base_amount, row.payable.currency)}
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      Toplam: {formatMoney(row.payable.base_amount, row.payable.currency)} · Ödenen:{" "}
                      {formatMoney(row.payable.paid_base_amount, row.payable.currency)}
                    </p>
                  </div>
                </div>

                {row.payable.description ? (
                  <p className="mt-3 text-sm leading-6 text-slate-500">{row.payable.description}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-500">Sayfa {safeCurrentPage} / {totalPages}</p>
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
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-rose-300"
      >
        {children}
      </select>
    </label>
  );
}
