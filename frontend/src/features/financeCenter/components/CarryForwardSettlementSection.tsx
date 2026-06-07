import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  fetchCashAccounts,
  settleCarryForwardItem,
} from "../api/financeCenterApi";
import type {
  CarryForwardItem,
  CarryForwardSettlementPayload,
  CashAccountRead,
} from "../types/financeCenterTypes";

type CarryForwardSettlementSectionProps = {
  carryForwards: CarryForwardItem[];
  focusKey?: number;
  onChanged: () => Promise<void> | void;
};

type CarryForwardTypeFilter =
  | "all"
  | "customer_receivable"
  | "supplier_payable"
  | "partner_cash_on_hand"
  | "company_payable_to_partner"
  | "open_event";

type CarryForwardStatusFilter = "all" | "open" | "partial";

type SettlementFormState = {
  settlementDate: string;
  amount: string;
  cashAccountId: string;
  paymentMethod: string;
  documentNo: string;
  notes: string;
};

const SUPPORTED_SETTLEMENT_TYPES = new Set([
  "customer_receivable",
  "supplier_payable",
  "partner_cash_on_hand",
  "company_payable_to_partner",
]);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

function getCarryTypeLabel(carryType: string) {
  const labels: Record<string, string> = {
    customer_receivable: "Müşteri Alacağı",
    supplier_payable: "Sanatçı / Hizmet Borcu",
    partner_cash_on_hand: "Ortağın Üzerindeki Para",
    company_payable_to_partner: "Şirketin Ortağa Borcu",
    open_event: "Açık Etkinlik",
  };

  return labels[carryType] ?? carryType;
}

function getCarryTypeHelp(carryType: string) {
  const labels: Record<string, string> = {
    customer_receivable:
      "Geçmiş dönemden gelen müşteri alacağı tahsil edilir. Yeni dönem kârı artmaz, sadece kasa/banka girişi oluşur.",
    supplier_payable:
      "Geçmiş dönemden gelen sanatçı/hizmet borcu ödenir. Yeni dönem gideri artmaz, sadece kasa/banka çıkışı oluşur.",
    partner_cash_on_hand:
      "Geçmiş dönemden ortağın üzerinde kalan şirket parası kasaya/bankaya alınır.",
    company_payable_to_partner:
      "Geçmiş dönemden şirketin ortağa olan borcu ödenir.",
    open_event:
      "Açık etkinlik devri bu ekrandan para işlemiyle kapanmaz. Etkinlik finans kapanışı ayrıca tamamlanmalıdır.",
  };

  return labels[carryType] ?? "Devreden açık kalem takip edilir.";
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Açık",
    partial: "Kısmi Kapalı",
    closed: "Kapalı",
  };

  return labels[status] ?? status;
}

function getStatusClasses(status: string) {
  if (status === "partial") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "closed") {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-teal-100 text-teal-800";
}

function getSettlementButtonText(carryType: string) {
  const labels: Record<string, string> = {
    customer_receivable: "Tahsil Et",
    supplier_payable: "Öde",
    partner_cash_on_hand: "Teslim Al",
    company_payable_to_partner: "Ortağa Öde",
  };

  return labels[carryType] ?? "Kapat";
}

function isSettlementSupported(item: CarryForwardItem) {
  return SUPPORTED_SETTLEMENT_TYPES.has(item.carry_type);
}

function parseAmount(value: string) {
  return Number(value.replace(",", "."));
}

export function CarryForwardSettlementSection({
  carryForwards,
  focusKey = 0,
  onChanged,
}: CarryForwardSettlementSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CarryForwardTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<CarryForwardStatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CarryForwardItem | null>(null);
  const [formState, setFormState] = useState<SettlementFormState>({
    settlementDate: todayIsoDate(),
    amount: "",
    cashAccountId: "",
    paymentMethod: "cash",
    documentNo: "",
    notes: "",
  });
  const [cashAccounts, setCashAccounts] = useState<CashAccountRead[]>([]);
  const [isCashAccountsLoading, setIsCashAccountsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (focusKey <= 0) {
      return;
    }

    setIsOpen(true);
    setCurrentPage(1);

    window.setTimeout(() => {
      document.getElementById("finance-carry-forwards-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, [focusKey]);

  const periodOptions = useMemo(() => {
    const periods = new Set<string>();

    carryForwards.forEach((item) => {
      if (item.source_period_month) {
        periods.add(item.source_period_month);
      }

      if (item.target_period_month) {
        periods.add(item.target_period_month);
      }
    });

    return Array.from(periods).sort().reverse();
  }, [carryForwards]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase("tr-TR");

    return carryForwards.filter((item) => {
      const matchesType = typeFilter === "all" || item.carry_type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPeriod =
        periodFilter === "all" ||
        item.source_period_month === periodFilter ||
        item.target_period_month === periodFilter;

      const searchableText = [
        item.id,
        getCarryTypeLabel(item.carry_type),
        item.carry_type,
        item.status,
        item.source_period_month,
        item.target_period_month,
        item.carry_reason,
        item.notes,
        item.event_id,
        item.customer_id,
        item.partner_id,
        item.artist_id,
        item.service_item_id,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const matchesSearch =
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);

      return matchesType && matchesStatus && matchesPeriod && matchesSearch;
    });
  }, [carryForwards, periodFilter, searchText, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const visibleItems = filteredItems.slice(pageStartIndex, pageStartIndex + pageSize);

  const filteredRemainingTotal = filteredItems.reduce(
    (total, item) => total + Number(item.remaining_base_amount ?? 0),
    0
  );
  const supportedItemCount = filteredItems.filter((item) => isSettlementSupported(item)).length;
  const openEventCount = filteredItems.filter((item) => item.carry_type === "open_event").length;

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  function openSettlementModal(item: CarryForwardItem) {
    if (!isSettlementSupported(item)) {
      return;
    }

    setSelectedItem(item);
    setFormError(null);
    setSuccessMessage(null);
    setFormState({
      settlementDate: todayIsoDate(),
      amount: String(Number(item.remaining_base_amount ?? 0)),
      cashAccountId: cashAccounts[0] ? String(cashAccounts[0].id) : "",
      paymentMethod: "cash",
      documentNo: "",
      notes: "",
    });
  }

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    let isMounted = true;

    async function loadCashAccounts() {
      setIsCashAccountsLoading(true);
      setFormError(null);

      try {
        const accounts = await fetchCashAccounts();

        if (!isMounted) {
          return;
        }

        setCashAccounts(accounts);

        if (accounts.length > 0) {
          setFormState((previous) => ({
            ...previous,
            cashAccountId: previous.cashAccountId || String(accounts[0].id),
          }));
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setFormError(
          error instanceof Error ? error.message : "Kasa/banka hesapları alınamadı."
        );
      } finally {
        if (isMounted) {
          setIsCashAccountsLoading(false);
        }
      }
    }

    loadCashAccounts();

    return () => {
      isMounted = false;
    };
  }, [selectedItem]);

  async function submitSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedItem) {
      return;
    }

    const amount = parseAmount(formState.amount);
    const remainingAmount = Number(selectedItem.remaining_base_amount ?? 0);

    if (!formState.settlementDate) {
      setFormError("Kapatma tarihi zorunludur.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Kapatılacak tutar sıfırdan büyük olmalıdır.");
      return;
    }

    if (amount > remainingAmount + 0.0001) {
      setFormError("Kapatılacak tutar kalan tutardan büyük olamaz.");
      return;
    }

    if (!formState.cashAccountId) {
      setFormError("Bu işlem için kasa/banka hesabı seçmelisin.");
      return;
    }

    const payload: CarryForwardSettlementPayload = {
      settlement_date: formState.settlementDate,
      amount,
      cash_account_id: Number(formState.cashAccountId),
      payment_method: formState.paymentMethod,
      document_no: formState.documentNo.trim() || null,
      notes: formState.notes.trim() || null,
    };

    setIsSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const response = await settleCarryForwardItem(selectedItem.id, payload);
      setSelectedItem(null);
      setSuccessMessage(response.message || "Devreden kalem işlendi.");
      await onChanged();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Devreden kalem kapatılamadı.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="finance-carry-forwards-section" className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Devreden Kalemler
          </p>
          <h3 className="mt-1 text-2xl font-black">Geçmiş dönem açık işleri</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Bu ekran geçmiş dönemden gelen alacak, borç ve ortak bakiyelerini kapatır. Eski dönem raporu değişmez; yeni dönem kâr/gider hesabı bozulmaz.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextIsOpen = !isOpen;
            setIsOpen(nextIsOpen);

            if (nextIsOpen) {
              window.setTimeout(() => {
                document.getElementById("finance-carry-forwards-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }, 80);
            }
          }}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
        >
          {isOpen ? "Kapat ▲" : "Detayı Aç ▼"}
        </button>
      </div>

      {successMessage ? (
        <div className="mt-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 p-4 text-sm font-bold leading-6 text-teal-900">
          {successMessage}
        </div>
      ) : null}

      {isOpen ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniMetric title="Filtrelenmiş Kayıt" value={String(filteredItems.length)} />
            <MiniMetric title="Kapanabilir Kalem" value={String(supportedItemCount)} />
            <MiniMetric title="Filtrelenmiş Kalan" value={formatMoney(filteredRemainingTotal)} />
          </div>

          {openEventCount > 0 ? (
            <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <p className="font-black">Bilgi</p>
              <p className="mt-1">
                Açık etkinlik devirleri bu ekrandan para işlemiyle kapatılmaz. Onlar için etkinlik finans kapanışı ayrı tamamlanacak.
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1.4fr_0.8fr]">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Devir Türü
              </span>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as CarryForwardTypeFilter);
                  resetToFirstPage();
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              >
                <option value="all">Tümü</option>
                <option value="customer_receivable">Müşteri Alacağı</option>
                <option value="supplier_payable">Sanatçı / Hizmet Borcu</option>
                <option value="partner_cash_on_hand">Ortağın Üzerindeki Para</option>
                <option value="company_payable_to_partner">Şirketin Ortağa Borcu</option>
                <option value="open_event">Açık Etkinlik</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Dönem
              </span>
              <select
                value={periodFilter}
                onChange={(event) => {
                  setPeriodFilter(event.target.value);
                  resetToFirstPage();
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              >
                <option value="all">Tüm Dönemler</option>
                {periodOptions.map((period) => (
                  <option key={period} value={period}>
                    {formatPeriodMonth(period)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Durum
              </span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as CarryForwardStatusFilter);
                  resetToFirstPage();
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              >
                <option value="all">Tümü</option>
                <option value="open">Açık</option>
                <option value="partial">Kısmi Kapalı</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Arama
              </span>
              <input
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  resetToFirstPage();
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
                placeholder="Tür, açıklama, dönem veya ID ara"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Sayfa
              </span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  resetToFirstPage();
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              >
                <option value={5}>5 kayıt</option>
                <option value={10}>10 kayıt</option>
                <option value={20}>20 kayıt</option>
                <option value={50}>50 kayıt</option>
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {visibleItems.length === 0 ? (
              <EmptyState text="Bu filtrelere uygun devreden açık kalem bulunmuyor." />
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{getCarryTypeLabel(item.carry_type)}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${getStatusClasses(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                          Devir ID: {item.id}
                        </span>
                      </div>

                      <p className="mt-2 text-xs font-bold text-slate-500">
                        {formatPeriodMonth(item.source_period_month)} → {formatPeriodMonth(item.target_period_month)}
                      </p>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {item.carry_reason || getCarryTypeHelp(item.carry_type)}
                      </p>

                      {item.notes ? (
                        <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                          Not: {item.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="w-full rounded-[1rem] bg-white p-4 text-left sm:w-72 sm:text-right">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        Kalan Tutar
                      </p>
                      <p className="mt-1 text-xl font-black">
                        {formatMoney(item.remaining_base_amount)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Ana tutar: {formatMoney(item.amount, item.currency)}
                      </p>

                      {isSettlementSupported(item) ? (
                        <button
                          type="button"
                          onClick={() => openSettlementModal(item)}
                          disabled={Number(item.remaining_base_amount ?? 0) <= 0}
                          className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {getSettlementButtonText(item.carry_type)}
                        </button>
                      ) : (
                        <p className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-black leading-5 text-amber-800">
                          Etkinlik kapanışı ile kapanır
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">
              {filteredItems.length === 0
                ? "Kayıt yok"
                : `${pageStartIndex + 1} - ${Math.min(
                    pageStartIndex + pageSize,
                    filteredItems.length
                  )} / ${filteredItems.length} kayıt`}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow disabled:opacity-40"
              >
                Önceki
              </button>
              <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 shadow disabled:opacity-40"
              >
                Sonraki
              </button>
            </div>
          </div>
        </>
      ) : null}

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
                  Devreden Kalem Kapat
                </p>
                <h3 className="mt-1 text-2xl font-black">
                  {getCarryTypeLabel(selectedItem.carry_type)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {getCarryTypeHelp(selectedItem.carry_type)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
              >
                Kapat
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniMetric title="Kalan" value={formatMoney(selectedItem.remaining_base_amount)} />
              <MiniMetric title="Kaynak Dönem" value={formatPeriodMonth(selectedItem.source_period_month)} />
              <MiniMetric title="Hedef Dönem" value={formatPeriodMonth(selectedItem.target_period_month)} />
            </div>

            {formError ? (
              <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-900">
                {formError}
              </div>
            ) : null}

            <form onSubmit={submitSettlement} className="mt-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Kapatma Tarihi
                  </span>
                  <input
                    type="date"
                    value={formState.settlementDate}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        settlementDate: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Kapatılacak Tutar
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.amount}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Kasa / Banka
                  </span>
                  <select
                    value={formState.cashAccountId}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        cashAccountId: event.target.value,
                      }))
                    }
                    disabled={isCashAccountsLoading}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400 disabled:opacity-60"
                  >
                    <option value="">
                      {isCashAccountsLoading ? "Hesaplar yükleniyor..." : "Kasa/banka seç"}
                    </option>
                    {cashAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    İşlem Yöntemi
                  </span>
                  <select
                    value={formState.paymentMethod}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        paymentMethod: event.target.value,
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
                  >
                    <option value="cash">Nakit</option>
                    <option value="bank_transfer">Banka Transferi</option>
                    <option value="credit_card">Kredi Kartı</option>
                    <option value="other">Diğer</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Belge No
                </span>
                <input
                  value={formState.documentNo}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      documentNo: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
                  placeholder="Makbuz, dekont veya fiş no"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Not
                </span>
                <textarea
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
                  placeholder="İşlem notu"
                />
              </label>

              <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p className="font-black">Kontrol</p>
                <p className="mt-1">
                  Bu işlem eski dönem raporunu değiştirmez. Sadece açık devir kalemini ve ilgili kasa/banka hareketini işler.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isCashAccountsLoading}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "İşleniyor..." : "Devreden Kalemi Kapat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}
