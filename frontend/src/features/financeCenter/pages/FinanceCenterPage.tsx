import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import type { AuthUser } from "../../../types/auth";
import MainLayout from "../../../components/MainLayout";
import {
  fetchCustomers,
  createCollection,
  fetchEventPayments,
  fetchEvents,
  fetchPartners,
  cancelExpense,
  createExpense,
  fetchExpenseDetail,
  fetchExpenses,
  fetchFinanceSummary,
  fetchOpenCarryForwards,
  fetchPeriodExpenseSummary,
  fetchRecentFinanceMovements,
  fetchSupplierPayables,
} from "../api/financeCenterApi";
import type {
  CustomerListItem,
  CreateCollectionPayload,
  EventPaymentsDetail,
  EventRead,
  PartnerRead,
  CarryForwardItem,
  CreateExpensePayload,
  ExpenseRead,
  ExpenseWithAllocations,
  FinancialMovement,
  FinancialMovementSummary,
  PeriodExpenseSummary,
} from "../types/financeCenterTypes";
import { CollectionRecordsSection } from "../components/CollectionRecordsSection";
import { SupplierPayablesSection } from "../components/SupplierPayablesSection";
import { SupplierPaymentQuickActionModal } from "../components/SupplierPaymentQuickActionModal";
import { CarryForwardSettlementSection } from "../components/CarryForwardSettlementSection";
import { EventFinancialClosureSection } from "../components/EventFinancialClosureSection";
import { PeriodClosingReportSection } from "../components/PeriodClosingReportSection";
import { ExpenseQuickEntryModal } from "../../expenses/components/ExpenseQuickEntryModal";

type FinanceCenterPageProps = {
  onBackToDashboard?: () => void;
  user: AuthUser;
  onLogout: () => void;
};

type ActivePanelKey =
  | "collectionRecords"
  | "carryForward"
  | "eventClosure"
  | "periodClose";

type QuickActionKey =
  | "collection"
  | "expense"
  | "supplierPayment"
  | "partnerCash"
  | "carryForward"
  | "eventClosure"
  | "periodClose";

type QuickAction = {
  key: QuickActionKey;
  title: string;
  description: string;
  helper: string;
  icon: string;
  tone: "dark" | "teal" | "white" | "amber";
  warningTitle: string;
  warningMessage: string;
};

type ExpenseFormState = {
  expenseScope: "period" | "season";
  title: string;
  expenseDate: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  allocationEndMonth: string;
  documentNo: string;
  description: string;
  notes: string;
};

const financeMovementPageSize = 5;

const defaultSummary: FinancialMovementSummary = {
  total_count: 0,
  total_in_base_amount: 0,
  total_out_base_amount: 0,
  net_base_amount: 0,
  company_cash_in_base_amount: 0,
  company_cash_out_base_amount: 0,
  partner_cash_in_base_amount: 0,
  partner_cash_out_base_amount: 0,
};

const quickActions: QuickAction[] = [
  {
    key: "collection",
    title: "Tahsilat Gir",
    description: "Müşteriden gelen ödemeyi kaydet.",
    helper: "Cari ve kasa hareketi sistem tarafından oluşturulur.",
    icon: "↗",
    tone: "teal",
    warningTitle: "Tahsilat Kaydedilecek",
    warningMessage:
      "Bu işlem müşteri alacağını azaltır ve kasa/banka hareketi oluşturur. Geçmiş dönemden devreden alacak seçilirse eski dönem raporu değişmez, yeni dönem kârı artmaz.",
  },
  {
    key: "expense",
    title: "Hızlı Gider Kaydı",
    description: "Aynı gider formunu hızlı işlem olarak aç.",
    helper: "Detaylı liste ve iptal işlemleri Gider Yönetimi ekranındadır.",
    icon: "▦",
    tone: "white",
    warningTitle: "Gider Kaydı Açılacak",
    warningMessage:
      "Normal gider ilgili döneme yazılır. Sezonluk gider seçilirse gider başlangıç ayından sezon sonuna kadar aylara bölünür.",
  },
  {
    key: "supplierPayment",
    title: "Sanatçı / Hizmet Ödemesi",
    description: "Açık sanatçı veya hizmet borcunu öde.",
    helper: "Ödeme gideri tekrar artırmaz; sadece borcu kapatır.",
    icon: "✓",
    tone: "dark",
    warningTitle: "Ödeme Kaydedilecek",
    warningMessage:
      "Bu işlem sanatçı/hizmet borcunu azaltır ve kasa/banka çıkışı oluşturur. Devreden borç kapatılıyorsa yeni dönem giderini artırmaz.",
  },
  {
    key: "partnerCash",
    title: "Ortaktan Para Teslim Al",
    description: "Ortak üzerinde kalan şirket parasını kapat.",
    helper: "Ortak cari ve kasa hareketi birlikte işlenir.",
    icon: "⇄",
    tone: "amber",
    warningTitle: "Ortak Üzerindeki Para Kapatılacak",
    warningMessage:
      "Bu işlem ortağın üzerindeki şirket parasını azaltır ve şirket kasa/banka girişini oluşturur. Eski dönem raporu değiştirilmez.",
  },
  {
    key: "carryForward",
    title: "Devreden Kalem Kapat",
    description: "Geçmiş dönemden gelen açık işi tamamla.",
    helper: "Müşteri alacağı, borç veya ortak bakiyesi kapatılır.",
    icon: "◎",
    tone: "white",
    warningTitle: "Devreden Kalem İşlenecek",
    warningMessage:
      "Bu işlem geçmiş dönemden gelen açık kalemi kapatır. Eski dönem kilidi korunur ve yeni dönem kâr/gider hesabı bozulmaz.",
  },
  {
    key: "eventClosure",
    title: "Etkinlik Finans Kapanışı",
    description: "Tek etkinliğin gelir, maliyet ve kâr/zarar hesabını kapat.",
    helper: "Açık alacak, borç ve ortak bakiyesi kontrol edilir.",
    icon: "◇",
    tone: "teal",
    warningTitle: "Etkinlik Finans Kapanışı Açılacak",
    warningMessage:
      "Bu işlem seçilen etkinlik için anlaşma, tahsilat, sanatçı/hizmet borçları, etkinlik giderleri ve kâr/zarar kontrolünü açar. Hazır olmayan etkinlik onaylanamaz.",
  },
  {
    key: "periodClose",
    title: "Dönem Kapanış Raporu",
    description: "Ay sonu gelir, gider, açık etkinlik ve devir kontrolünü yap.",
    helper: "Önce rapor hazırlanır, sonra kontrollü kapanış yapılır.",
    icon: "■",
    tone: "dark",
    warningTitle: "Dönem Kapanış Raporu Açılacak",
    warningMessage:
      "Bu işlem önce dönem kapanış raporunu açar. Dönem sadece rapor ekranının altındaki ayrıca onaylanan işlemle kapatılır.",
  },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentPeriodMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPeriodMonthFromDate(value: string) {
  if (!value || value.length < 7) {
    return getCurrentPeriodMonth();
  }

  return value.slice(0, 7);
}

function getYearEndMonth(value: string) {
  const year =
    value && value.length >= 4
      ? value.slice(0, 4)
      : String(new Date().getFullYear());
  return `${year}-12`;
}

function parsePeriodMonth(periodMonth: string) {
  const [yearText, monthText] = periodMonth.split("-");
  return {
    year: Number(yearText),
    month: Number(monthText),
  };
}

function getMonthCount(startMonth: string, endMonth: string) {
  const start = parsePeriodMonth(startMonth);
  const end = parsePeriodMonth(endMonth);

  if (
    Number.isNaN(start.year) ||
    Number.isNaN(start.month) ||
    Number.isNaN(end.year) ||
    Number.isNaN(end.month)
  ) {
    return 0;
  }

  return (end.year - start.year) * 12 + (end.month - start.month) + 1;
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

function formatMoney(
  value: number | string | null | undefined,
  currency = "TL"
) {
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

async function fetchLiveSupplierPayableTotal() {
  const events = await fetchEvents();
  const results = await Promise.allSettled(
    events.map((eventItem) => fetchSupplierPayables(eventItem.id))
  );

  return results.reduce((total, result) => {
    if (result.status !== "fulfilled") {
      return total;
    }

    return (
      total +
      result.value.payables
        .filter(
          (payable) =>
            (payable.status === "open" || payable.status === "partial") &&
            Number(payable.remaining_base_amount ?? 0) > 0
        )
        .reduce(
          (payableTotal, payable) =>
            payableTotal + Number(payable.remaining_base_amount ?? 0),
          0
        )
    );
  }, 0);
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

function getMovementLabel(movementType: string) {
  const labels: Record<string, string> = {
    collection_created: "Tahsilat Kaydı",
    collection_cancelled: "Tahsilat İptali",
    partner_cash_transfer_to_company: "Ortak Para Teslimi",
    company_cash_transfer_from_partner: "Şirket Kasasına Giriş",
    supplier_payable_created: "Sanatçı / Hizmet Borcu",
    supplier_payment_created: "Sanatçı / Hizmet Ödemesi",
    supplier_payment_cancelled: "Ödeme İptali",
    carry_forward_customer_collection: "Devreden Alacak Tahsilatı",
    carry_forward_supplier_payment: "Devreden Borç Ödemesi",
    carry_forward_partner_cash_to_company: "Devreden Ortak Parası",
    carry_forward_company_cash_from_partner: "Devreden Para Girişi",
    carry_forward_company_payment_to_partner: "Ortağa Devreden Borç Ödemesi",
  };

  return labels[movementType] ?? movementType;
}

function getExpenseScopeLabel(expense: ExpenseRead) {
  if (expense.event_id !== null) {
    return "Etkinliğe Özel Gider";
  }

  return expense.is_allocated ? "Sezonluk Gider" : "Genel Dönem Gideri";
}

function getExpenseStatusLabel(expense: ExpenseRead) {
  if (expense.is_cancelled || expense.status === "cancelled") {
    return "İptal Edildi";
  }

  return "Aktif";
}

function getDefaultExpenseForm(): ExpenseFormState {
  const today = todayIsoDate();

  return {
    expenseScope: "period",
    title: "",
    expenseDate: today,
    amount: "",
    currency: "TRY",
    exchangeRate: "1",
    allocationEndMonth: getYearEndMonth(today),
    documentNo: "",
    description: "",
    notes: "",
  };
}

function getToneClasses(tone: QuickAction["tone"]) {
  if (tone === "teal") {
    return "border-teal-200 bg-white text-slate-800 shadow-sm hover:border-teal-300 hover:bg-teal-50";
  }

  if (tone === "dark") {
    return "border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-white text-slate-800 shadow-sm hover:border-amber-300 hover:bg-amber-50";
  }

  return "border-slate-200 bg-white text-slate-800 shadow-sm hover:border-teal-200 hover:bg-slate-50";
}

export function FinanceCenterPage({
  onBackToDashboard,
  user,
  onLogout,
}: FinanceCenterPageProps) {
  const currentPeriodMonth = useMemo(() => getCurrentPeriodMonth(), []);

  const [summary, setSummary] =
    useState<FinancialMovementSummary>(defaultSummary);
  const [periodExpenseSummary, setPeriodExpenseSummary] =
    useState<PeriodExpenseSummary | null>(null);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [carryForwards, setCarryForwards] = useState<CarryForwardItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRead[]>([]);
  const [liveSupplierPayableTotal, setLiveSupplierPayableTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(
    null
  );
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showSupplierPaymentModal, setShowSupplierPaymentModal] =
    useState(false);

  const [supplierPayablesRefreshKey, setSupplierPayablesRefreshKey] =
    useState(0);
  const [carryForwardFocusKey, setCarryForwardFocusKey] = useState(0);
  const [eventClosureFocusKey, setEventClosureFocusKey] = useState(0);
  const [periodClosingFocusKey, setPeriodClosingFocusKey] = useState(0);

  const [collectionQuickOpenKey, setCollectionQuickOpenKey] = useState(0);
  const [collectionQuickOpenMode, setCollectionQuickOpenMode] = useState<
    "partner-cash" | null
  >(null);

  const [selectedExpense, setSelectedExpense] =
    useState<ExpenseWithAllocations | null>(null);
  const [isExpenseDetailLoading, setIsExpenseDetailLoading] = useState(false);
  const [expenseDetailError, setExpenseDetailError] = useState<string | null>(
    null
  );

  const [cancelExpenseTarget, setCancelExpenseTarget] =
    useState<ExpenseRead | null>(null);

  const [isMovementsOpen, setIsMovementsOpen] = useState(false);

  const [activePanel, setActivePanel] = useState<ActivePanelKey | null>(null);

  const [movementPage, setMovementPage] = useState(1);

  async function loadDashboard() {
    setIsLoading(true);
    setLoadError(null);

    const results = await Promise.allSettled([
      fetchFinanceSummary(),
      fetchRecentFinanceMovements({
        skip: (movementPage - 1) * financeMovementPageSize,
        limit: financeMovementPageSize,
      }),
      fetchOpenCarryForwards(),
      fetchPeriodExpenseSummary(currentPeriodMonth),
      fetchExpenses(),
      fetchLiveSupplierPayableTotal(),
    ]);

    if (results[0].status === "fulfilled") {
      setSummary(results[0].value);
    }

    if (results[1].status === "fulfilled") {
      setMovements(results[1].value.items);
    }

    if (results[2].status === "fulfilled") {
      setCarryForwards(results[2].value);
    }

    if (results[3].status === "fulfilled") {
      setPeriodExpenseSummary(results[3].value);
    }

    if (results[4].status === "fulfilled") {
      setExpenses(results[4].value);
    }

    if (results[5].status === "fulfilled") {
      setLiveSupplierPayableTotal(results[5].value);
    }

    const rejected = results.filter((item) => item.status === "rejected");

    if (rejected.length > 0) {
      setLoadError(
        "Bazı finans verileri alınamadı. Sayfa çalışmaya devam ediyor."
      );
    }

    setIsLoading(false);
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriodMonth, movementPage]);

  const openCarryForwardTotal = carryForwards.reduce(
    (total, item) => total + Number(item.remaining_base_amount ?? 0),
    0
  );

  const partnerCashOnHandTotal = carryForwards
    .filter((item) => item.carry_type === "partner_cash_on_hand")
    .reduce(
      (total, item) => total + Number(item.remaining_base_amount ?? 0),
      0
    );

  const supplierPayableTotal = liveSupplierPayableTotal;

  const customerReceivableTotal = carryForwards
    .filter((item) => item.carry_type === "customer_receivable")
    .reduce(
      (total, item) => total + Number(item.remaining_base_amount ?? 0),
      0
    );

  const cashBalance =
    summary.company_cash_in_base_amount - summary.company_cash_out_base_amount;

  const movementTotalPages = Math.max(
    1,
    Math.ceil(summary.total_count / financeMovementPageSize)
  );

  function handleQuickAction(action: QuickAction) {
    if (action.key === "collection") {
      setShowCollectionModal(true);
      return;
    }

    if (action.key === "expense") {
      setShowExpenseModal(true);
      return;
    }

    if (action.key === "supplierPayment") {
      setShowSupplierPaymentModal(true);
      return;
    }

    if (action.key === "partnerCash") {
      setCollectionQuickOpenMode("partner-cash");
      setCollectionQuickOpenKey((previous) => previous + 1);
      setActivePanel("collectionRecords");
      return;
    }

    if (action.key === "carryForward") {
      setCarryForwardFocusKey((previous) => previous + 1);
      setActivePanel("carryForward");
      return;
    }

    if (action.key === "eventClosure") {
      setEventClosureFocusKey((previous) => previous + 1);
      setActivePanel("eventClosure");
      return;
    }

    if (action.key === "periodClose") {
      setPeriodClosingFocusKey((previous) => previous + 1);
      setActivePanel("periodClose");
      return;
    }

    setSelectedAction(action);
  }

  async function openExpenseDetail(expenseId: number) {
    setIsExpenseDetailLoading(true);
    setExpenseDetailError(null);

    try {
      const detail = await fetchExpenseDetail(expenseId);
      setSelectedExpense(detail);
    } catch (error) {
      setExpenseDetailError(
        error instanceof Error ? error.message : "Gider detayı alınamadı."
      );
    } finally {
      setIsExpenseDetailLoading(false);
    }
  }

  async function handleExpenseCancelled() {
    setCancelExpenseTarget(null);
    setSelectedExpense(null);
    await loadDashboard();
  }

  return (
    <MainLayout
      userName={user?.full_name ?? "Yönetici"}
      onLogout={onLogout}
      onBack={onBackToDashboard}
    >
      <div className="flex h-full w-full flex-col">
        {/* === SABİT ÜST KISIM (KAYMAZ) === */}
        <div className="flex-none flex flex-col space-y-5 px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
                  Ön Muhasebe Paneli
                </p>
                <h1 className="mt-2 text-3xl font-normal text-slate-800">
                  Finans Merkezi
                </h1>
                <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                  Tahsilat, ödeme, gider, devir ve dönem kapanışı işlemleri için sade günlük takip ekranı.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 px-6 py-4 text-left sm:text-right text-white shadow-md min-w-[160px]">
                <p className="text-xs font-medium uppercase tracking-widest text-teal-300 opacity-90">
                  Aktif Dönem
                </p>
                <p className="mt-1 text-xl font-normal">{currentPeriodMonth}</p>
              </div>
            </div>
          </div>

          {loadError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-medium text-amber-900 shadow-sm">
              {loadError}
            </div>
          ) : null}

          {expenseDetailError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-900 shadow-sm">
              {expenseDetailError}
            </div>
          ) : null}
        </div>

        {/* === KAYDIRILABİLİR İÇERİK ALANI === */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
          <div className="flex flex-col gap-6">
            
            {/* Metrik Kartları */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SummaryCard
                title="Kasa / Banka Net"
                value={formatMoney(cashBalance)}
                description="Şirket kasa/banka giriş - çıkış özeti"
                tone="dark"
              />
              <SummaryCard
                title="Bekleyen Alacak"
                value={formatMoney(customerReceivableTotal)}
                description="Devreden müşteri alacağı"
                tone="teal"
              />
              <SummaryCard
                title="Ödenecek Borç"
                value={formatMoney(supplierPayableTotal)}
                description="Açık sanatçı / hizmet borcu"
                tone="white"
              />
              <SummaryCard
                title="Ortak Üzerindeki Para"
                value={formatMoney(partnerCashOnHandTotal)}
                description="Teslim bekleyen ortak tahsilatı"
                tone="amber"
              />
              <SummaryCard
                title="Devreden Kalem"
                value={String(carryForwards.length)}
                description={formatMoney(openCarryForwardTotal)}
                tone="white"
              />
              <SummaryCard
                title="Bu Ay Genel Gider"
                value={formatMoney(
                  periodExpenseSummary?.total_period_expense_base_amount ?? 0
                )}
                description="Genel dönem gideri + sezonluk gider payı"
                tone="dark"
              />
            </div>

            {/* Hızlı İşlemler Modülü */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
                <div>
                  <h3 className="text-xl font-normal text-slate-800">
                    Hızlı İşlemler
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Sık kullanılan muhasebe fonksiyonları
                  </p>
                </div>
                <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700">
                  Kritik işlemlerde onay sorulur
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {quickActions.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => handleQuickAction(action)}
                    className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${getToneClasses(
                      action.tone
                    )}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base font-normal text-white transition group-hover:bg-teal-500">
                        {action.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-medium text-slate-800 leading-tight">
                          {action.title}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                          {action.description}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 border-t border-slate-100/50 pt-3 text-[11px] font-medium leading-relaxed text-slate-400">
                      {action.helper}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* Hareketler / Paneller Alanı */}
            <div className="grid items-start gap-6 xl:grid-cols-[1fr_minmax(0,1.2fr)]">
              {/* Sol Sütun: Listeler ve Hareketler */}
              <div className="flex flex-col gap-6">
                <section
                  id="finance-movements-section"
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
                    <div>
                      <h3 className="text-xl font-normal text-slate-800">
                        Son Finans Hareketleri
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Denetim izi ve hesap geçmişi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMovementsOpen((prev) => !prev)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      {isMovementsOpen ? "Kapat ▲" : "Tümünü Gör ▼"}
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="hidden grid-cols-[150px_1fr_minmax(0,1.5fr)_130px] gap-4 bg-slate-50 px-5 py-3 text-[11px] font-medium uppercase tracking-widest text-slate-500 md:grid">
                      <span>Tarih / Tür</span>
                      <span>İşlem</span>
                      <span>Açıklama</span>
                      <span className="text-right">Tutar</span>
                    </div>

                    {movements.length === 0 ? (
                      <div className="p-6 text-center text-sm font-medium text-slate-500">
                        Henüz finans hareketi bulunmuyor.
                      </div>
                    ) : (
                      (isMovementsOpen ? movements : movements.slice(0, 3)).map(
                        (movement) => (
                          <div
                            key={movement.id}
                            className="grid gap-3 border-t border-slate-100 px-5 py-4 text-sm md:grid-cols-[150px_1fr_minmax(0,1.5fr)_130px] md:items-center"
                          >
                            <div>
                              <p className="font-medium text-slate-800">
                                {movement.movement_date}
                              </p>
                              <p className="mt-1 text-xs font-normal text-slate-500">
                                {getMovementLabel(movement.movement_type)}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">
                                {movement.title}
                              </p>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed truncate md:whitespace-normal">
                              {movement.description ?? "-"}
                            </p>
                            <div className="md:text-right">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                                  movement.direction === "in"
                                    ? "bg-teal-50 text-teal-700 border border-teal-100"
                                    : "bg-rose-50 text-rose-700 border border-rose-100"
                                }`}
                              >
                                {movement.direction === "in" ? "+" : "-"}
                                {formatMoney(
                                  movement.base_amount,
                                  movement.currency
                                )}
                              </span>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>

                  {isMovementsOpen ? (
                    <div className="mt-5 flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500">
                        Sayfa {movementPage} / {movementTotalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={movementPage <= 1}
                          onClick={() =>
                            setMovementPage((prev) => Math.max(1, prev - 1))
                          }
                          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          Önceki
                        </button>
                        <button
                          type="button"
                          disabled={movementPage >= movementTotalPages}
                          onClick={() =>
                            setMovementPage((prev) =>
                              Math.min(movementTotalPages, prev + 1)
                            )
                          }
                          className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                        >
                          Sonraki
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>

                <ExpenseRecordsSection
                  expenses={expenses}
                  isDetailLoading={isExpenseDetailLoading}
                  currentPeriodMonth={currentPeriodMonth}
                  onOpenDetail={openExpenseDetail}
                />
              </div>

              {/* Sağ Sütun: Dinamik Panel Alanı */}
              <div className="sticky top-6">
                {activePanel === null ? (
                  <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm font-medium text-slate-600">
                      İşlem yapmak için Hızlı İşlemler'den bir seçenek belirleyin.
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Gelişmiş ödeme, devir ve kapanış panelleri bu alanda açılacaktır.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[2rem] bg-slate-900 p-1 shadow-xl">
                    <div className="flex items-center justify-between px-5 py-4">
                      <p className="text-sm font-medium text-white">
                        {getFinancePanelTitle(activePanel)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActivePanel(null)}
                        className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
                      >
                        Kapat ✕
                      </button>
                    </div>
                    <div className="rounded-[1.75rem] bg-white p-5 sm:p-6 shadow-inner">
                      {activePanel === "collectionRecords" ? (
                        <CollectionRecordsSection
                          key={collectionQuickOpenKey}
                          quickOpenMode={collectionQuickOpenMode}
                          onChanged={loadDashboard}
                        />
                      ) : null}

                      {activePanel === "carryForward" ? (
                        <CarryForwardSettlementSection
                          key={carryForwardFocusKey}
                          carryForwards={carryForwards}
                          onChanged={loadDashboard}
                        />
                      ) : null}

                      {activePanel === "eventClosure" ? (
                        <EventFinancialClosureSection
                          key={eventClosureFocusKey}
                          onChanged={loadDashboard}
                        />
                      ) : null}

                      {activePanel === "periodClose" ? (
                        <PeriodClosingReportSection
                          key={periodClosingFocusKey}
                          currentPeriodMonth={currentPeriodMonth}
                          onChanged={loadDashboard}
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* MODALLAR */}
      {selectedAction ? (
        <ActionWarningModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
        />
      ) : null}

      {showCollectionModal ? (
        <CollectionModal
          onClose={() => setShowCollectionModal(false)}
          onSaved={async () => {
            setShowCollectionModal(false);
            await loadDashboard();
          }}
        />
      ) : null}

      {showSupplierPaymentModal ? (
        <SupplierPaymentQuickActionModal
          onClose={() => setShowSupplierPaymentModal(false)}
          onSaved={async () => {
            setShowSupplierPaymentModal(false);
            setSupplierPayablesRefreshKey((previous) => previous + 1);
            await loadDashboard();
          }}
        />
      ) : null}

      {showExpenseModal ? (
        <ExpenseQuickEntryModal
          onClose={() => setShowExpenseModal(false)}
          onSaved={async () => {
            setShowExpenseModal(false);
            await loadDashboard();
          }}
        />
      ) : null}

      {selectedExpense ? (
        <ExpenseDetailModal
          detail={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onCancelRequest={(expense) => setCancelExpenseTarget(expense)}
        />
      ) : null}

      {cancelExpenseTarget ? (
        <CancelExpenseModal
          expense={cancelExpenseTarget}
          onClose={() => setCancelExpenseTarget(null)}
          onCancelled={handleExpenseCancelled}
        />
      ) : null}
    </MainLayout>
  );
}

function getFinancePanelTitle(activePanel: ActivePanelKey) {
  const titles: Record<ActivePanelKey, string> = {
    collectionRecords: "Ortaktan Para Teslim Al",
    carryForward: "Devreden Kalem Kapat",
    eventClosure: "Etkinlik Finans Kapanışı",
    periodClose: "Dönem Kapanış Raporu",
  };

  return titles[activePanel];
}

function FinanceDetailModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] bg-slate-50 p-4 text-slate-800 shadow-2xl sm:p-6">
        <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-white/95 p-5 backdrop-blur shadow-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
              Detaylı Finans İşlemi
            </p>
            <h3 className="mt-1 text-2xl font-normal text-slate-800">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  tone: "dark" | "teal" | "white" | "amber";
};

function SummaryCard({ title, value, description, tone }: SummaryCardProps) {
  const accentClasses =
    tone === "dark"
      ? "bg-slate-800"
      : tone === "teal"
      ? "bg-teal-500"
      : tone === "amber"
      ? "bg-amber-400"
      : "bg-slate-300";

  const valueClasses =
    tone === "teal"
      ? "text-teal-700"
      : tone === "amber"
      ? "text-amber-700"
      : "text-slate-800";

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5">
      <div className={`h-1.5 w-10 rounded-full ${accentClasses}`} />
      <p className="mt-4 text-[11px] font-medium uppercase tracking-widest text-slate-500">
        {title}
      </p>
      <p
        className={`mt-2 text-2xl font-normal tracking-tight ${valueClasses}`}
      >
        {value}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        {description}
      </p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-medium text-slate-500 text-center">
      {text}
    </div>
  );
}

function ExpenseRecordsSection({
  expenses,
  isDetailLoading,
  currentPeriodMonth,
  onOpenDetail,
}: {
  expenses: ExpenseRead[];
  isDetailLoading: boolean;
  currentPeriodMonth: string;
  onOpenDetail: (expenseId: number) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"general" | "event" | "all">(
    "general"
  );
  const [periodFilter, setPeriodFilter] = useState(currentPeriodMonth);
  const [scopeFilter, setScopeFilter] = useState<"all" | "period" | "season">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<
    "active" | "cancelled" | "all"
  >("active");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  const periodOptions = useMemo(() => {
    const periods = new Set<string>();

    expenses.forEach((expense) => {
      periods.add(getPeriodMonthFromDate(expense.expense_date));

      if (expense.allocation_start_month) {
        periods.add(expense.allocation_start_month);
      }

      if (expense.allocation_end_month) {
        periods.add(expense.allocation_end_month);
      }
    });

    periods.add(currentPeriodMonth);

    return Array.from(periods).sort().reverse();
  }, [expenses, currentPeriodMonth]);

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase("tr-TR");

    return expenses.filter((expense) => {
      const expensePeriod = getPeriodMonthFromDate(expense.expense_date);
      const isEventSpecificExpense = expense.event_id !== null;

      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "general" && !isEventSpecificExpense) ||
        (sourceFilter === "event" && isEventSpecificExpense);

      const matchesPeriod =
        periodFilter === "all" ||
        expensePeriod === periodFilter ||
        (expense.is_allocated &&
          expense.allocation_start_month !== null &&
          expense.allocation_end_month !== null &&
          periodFilter >= expense.allocation_start_month &&
          periodFilter <= expense.allocation_end_month);

      const matchesScope =
        scopeFilter === "all" ||
        (scopeFilter === "season" && expense.is_allocated) ||
        (scopeFilter === "period" && !expense.is_allocated);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !expense.is_cancelled) ||
        (statusFilter === "cancelled" && expense.is_cancelled);

      const searchableText = [
        expense.title,
        expense.description,
        expense.document_no,
        expense.expense_type,
        expense.currency,
        expense.cancellation_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch);

      return (
        matchesPeriod &&
        matchesScope &&
        matchesStatus &&
        matchesSource &&
        matchesSearch
      );
    });
  }, [
    expenses,
    periodFilter,
    scopeFilter,
    statusFilter,
    sourceFilter,
    searchText,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const visibleExpenses = filteredExpenses.slice(
    pageStartIndex,
    pageStartIndex + pageSize
  );

  const activeExpenses = filteredExpenses.filter(
    (expense) => !expense.is_cancelled
  );
  const cancelledExpenses = filteredExpenses.filter(
    (expense) => expense.is_cancelled
  );
  const activeTotal = activeExpenses.reduce(
    (total, expense) => total + Number(expense.base_amount ?? 0),
    0
  );

  function resetToFirstPage() {
    setCurrentPage(1);
  }

  function changePeriodFilter(value: string) {
    setPeriodFilter(value);
    resetToFirstPage();
  }

  function changeSourceFilter(value: "general" | "event" | "all") {
    setSourceFilter(value);
    resetToFirstPage();
  }

  function changeScopeFilter(value: "all" | "period" | "season") {
    setScopeFilter(value);
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
    <section
      id="finance-expense-records-section"
      className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Genel Gider Kayıtları
          </p>
          <h3 className="mt-1 text-xl font-normal text-slate-800">
            Genel gider takip ekranı
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 max-w-xl">
            Bu liste genel dönem ve sezonluk gider kayıtları içindir. Etkinliğe
            özel giderler etkinlik finans/kârlılık ekranında yönetilir.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 shrink-0">
          {isOpen ? (
            <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-right">
              <p className="text-[10px] font-medium uppercase tracking-widest text-teal-600">
                Filtrelenmiş Aktif Toplam
              </p>
              <p className="text-lg font-medium text-slate-800 mt-1">
                {formatMoney(activeTotal)}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const nextIsOpen = !isOpen;
              setIsOpen(nextIsOpen);

              if (nextIsOpen) {
                scrollToElementById("finance-expense-records-section");
              }
            }}
            className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-100"
          >
            {isOpen ? "Kapat ▲" : "Detayı Aç ▼"}
          </button>
        </div>
      </div>

      {isOpen ? (
        <>
          <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-3">
            <MiniMetric
              title="Filtrelenmiş Kayıt"
              value={String(filteredExpenses.length)}
            />
            <MiniMetric
              title="Aktif / İptal"
              value={`${activeExpenses.length} / ${cancelledExpenses.length}`}
            />
            <MiniMetric
              title="Sezonluk"
              value={String(
                filteredExpenses.filter((expense) => expense.is_allocated)
                  .length
              )}
            />
          </div>

          <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-6">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
                Ay
              </span>
              <select
                value={periodFilter}
                onChange={(event) => changePeriodFilter(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-400"
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
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
                Kaynak
              </span>
              <select
                value={sourceFilter}
                onChange={(event) =>
                  changeSourceFilter(
                    event.target.value as "general" | "event" | "all"
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-400"
              >
                <option value="general">Genel + Sezonluk</option>
                <option value="event">Etkinliğe Özel</option>
                <option value="all">Tümü</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
                Tür
              </span>
              <select
                value={scopeFilter}
                onChange={(event) =>
                  changeScopeFilter(
                    event.target.value as "all" | "period" | "season"
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-400"
              >
                <option value="all">Tümü</option>
                <option value="period">Normal Dönem</option>
                <option value="season">Sezonluk</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
                Durum
              </span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  changeStatusFilter(
                    event.target.value as "active" | "cancelled" | "all"
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-400"
              >
                <option value="active">Aktif</option>
                <option value="cancelled">İptal Edilen</option>
                <option value="all">Tümü</option>
              </select>
            </label>

            <label className="block xl:col-span-2">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
                Arama
              </span>
              <div className="flex gap-2">
                <input
                  value={searchText}
                  onChange={(event) => changeSearchText(event.target.value)}
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-teal-400 placeholder:text-slate-400"
                  placeholder="Başlık, belge vb. ara"
                />
                <select
                  value={pageSize}
                  onChange={(event) =>
                    changePageSize(Number(event.target.value))
                  }
                  className="h-11 w-24 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600 outline-none focus:border-teal-400"
                >
                  <option value={5}>5 kayıt</option>
                  <option value={10}>10 kayıt</option>
                  <option value={20}>20 kayıt</option>
                  <option value={50}>50 kayıt</option>
                </select>
              </div>
            </label>
          </div>

          <div className="mt-6 space-y-3">
            {visibleExpenses.length === 0 ? (
              <EmptyState text="Bu filtrelere uygun gider kaydı bulunmuyor." />
            ) : (
              visibleExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                    expense.is_cancelled
                      ? "border-red-100 bg-red-50/50"
                      : "border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="font-medium text-slate-800 text-base">
                          {expense.title}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                            expense.is_allocated
                              ? "bg-teal-100 text-teal-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {getExpenseScopeLabel(expense)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                            expense.is_cancelled
                              ? "bg-red-100 text-red-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {getExpenseStatusLabel(expense)}
                        </span>
                      </div>

                      <p className="text-[11px] font-medium text-slate-500 mb-2">
                        {formatDate(expense.expense_date)} · Belge:{" "}
                        {expense.document_no ?? "-"}
                      </p>

                      <p className="text-sm leading-relaxed text-slate-600 line-clamp-2">
                        {expense.description ?? "Açıklama yok."}
                      </p>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0">
                      <p className="text-lg font-medium text-slate-800">
                        {formatMoney(expense.base_amount, expense.currency)}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenDetail(expense.id)}
                        disabled={isDetailLoading}
                        className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap"
                      >
                        Detayı Aç
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 p-3 sm:p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">
              {filteredExpenses.length === 0
                ? "Kayıt yok"
                : `${pageStartIndex + 1} - ${Math.min(
                    pageStartIndex + pageSize,
                    filteredExpenses.length
                  )} / ${filteredExpenses.length} kayıt`}
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage <= 1}
                className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                ←
              </button>
              <span className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-1.5 text-xs font-medium text-teal-800">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={safeCurrentPage >= totalPages}
                className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                →
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-xl font-normal text-slate-800">{value}</p>
    </div>
  );
}

function ActionWarningModal({
  action,
  onClose,
}: {
  action: QuickAction;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 sm:p-8 text-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
              İşlem Öncesi Uyarı
            </p>
            <h3 className="mt-2 text-2xl font-normal text-slate-800">
              {action.warningTitle}
            </h3>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-600">
          {action.warningMessage}
        </p>

        <div className="mt-6 rounded-2xl bg-amber-50 border border-amber-100 p-5 text-sm leading-relaxed text-amber-900">
          Bu işlem formu sonraki adımda bağlanacak. Gider faturası formu ve
          gider kayıt listesi artık canlı çalışıyor.
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ExpenseFormState>(() =>
    getDefaultExpenseForm()
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const amount = Number(form.amount || 0);
  const exchangeRate = Number(form.exchangeRate || 1);
  const baseAmount = amount * exchangeRate;
  const startMonth = getPeriodMonthFromDate(form.expenseDate);
  const endMonth =
    form.expenseScope === "season"
      ? form.allocationEndMonth || getYearEndMonth(form.expenseDate)
      : startMonth;
  const monthCount =
    form.expenseScope === "season" ? getMonthCount(startMonth, endMonth) : 1;
  const monthlyShare = monthCount > 0 ? baseAmount / monthCount : 0;

  function updateForm<K extends keyof ExpenseFormState>(
    key: K,
    value: ExpenseFormState[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "expenseDate" && previous.expenseScope === "season"
        ? { allocationEndMonth: getYearEndMonth(String(value)) }
        : {}),
    }));
    setIsConfirming(false);
    setFormError(null);
  }

  function validateForm() {
    if (!form.title.trim()) {
      return "Gider başlığı zorunludur.";
    }

    if (!form.expenseDate) {
      return "Gider tarihi zorunludur.";
    }

    if (!amount || amount <= 0) {
      return "Tutar sıfırdan büyük olmalıdır.";
    }

    if (!exchangeRate || exchangeRate <= 0) {
      return "Kur sıfırdan büyük olmalıdır.";
    }

    if (form.expenseScope === "season" && monthCount <= 0) {
      return "Sezonluk giderde bitiş ayı başlangıç ayından önce olamaz.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      const payload: CreateExpensePayload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        expense_date: form.expenseDate,
        amount,
        currency: form.currency,
        exchange_rate: exchangeRate,
        expense_scope: form.expenseScope,
        expense_type: form.expenseScope === "season" ? "seasonal" : "general",
        allocation_end_month: form.expenseScope === "season" ? endMonth : null,
        document_no: form.documentNo.trim() || null,
        notes: form.notes.trim() || null,
      };

      await createExpense(payload);
      await onSaved();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Gider kaydedilemedi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
      >
        <div className="flex-none flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
              Gider İşlemi
            </p>
            <h3 className="mt-1 text-2xl font-normal text-slate-800">
              Gider Faturası Gir
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Normal dönem gideri ya da sezonluk gider olarak kaydedebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2 mb-6">
            <button
              type="button"
              onClick={() => updateForm("expenseScope", "period")}
              className={`rounded-2xl border p-5 text-left transition ${
                form.expenseScope === "period"
                  ? "border-slate-800 bg-slate-800 text-white shadow-md"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <p className="font-medium text-base">Genel Dönem Gideri</p>
              <p className="mt-2 text-xs leading-relaxed opacity-80">
                Gider sadece seçilen ayın sonucuna dahil edilir.
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateForm("expenseScope", "season")}
              className={`rounded-2xl border p-5 text-left transition ${
                form.expenseScope === "season"
                  ? "border-teal-500 bg-teal-500 text-white shadow-md"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <p className="font-medium text-base">Sezonluk Gider</p>
              <p className="mt-2 text-xs leading-relaxed opacity-80">
                Gider başlangıç ayından sezon sonuna kadar aylara bölünür.
              </p>
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Gider Başlığı">
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="Örn: Sezon reklam gideri"
              />
            </FormField>

            <FormField label="Gider Tarihi">
              <input
                type="date"
                value={form.expenseDate}
                onChange={(event) =>
                  updateForm("expenseDate", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
              />
            </FormField>

            <FormField label="Tutar">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="0.00"
              />
            </FormField>

            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <FormField label="Para Birimi">
                <select
                  value={form.currency}
                  onChange={(event) =>
                    updateForm("currency", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                >
                  <option value="TRY">TRY</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </FormField>

              <FormField label="Kur">
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.exchangeRate}
                  onChange={(event) =>
                    updateForm("exchangeRate", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                />
              </FormField>
            </div>

            {form.expenseScope === "season" ? (
              <FormField label="Sezon Bitiş Ayı">
                <input
                  type="month"
                  value={form.allocationEndMonth}
                  onChange={(event) =>
                    updateForm("allocationEndMonth", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                />
              </FormField>
            ) : null}

            <FormField label="Belge No">
              <input
                value={form.documentNo}
                onChange={(event) =>
                  updateForm("documentNo", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="Fatura / belge no"
              />
            </FormField>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label="Açıklama">
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="Gider açıklaması"
              />
            </FormField>

            <FormField label="Not">
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="İç not"
              />
            </FormField>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              İşlem Özeti
            </p>
            {form.expenseScope === "period" ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Bu gider <strong className="font-medium">{formatPeriodMonth(startMonth)}</strong>{" "}
                dönemine normal gider olarak yazılacak. Toplam etki:{" "}
                <strong className="font-medium text-slate-900">{formatMoney(baseAmount, form.currency)}</strong>
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Bu sezonluk gider <strong className="font-medium">{formatPeriodMonth(startMonth)}</strong> -{" "}
                <strong className="font-medium">{formatPeriodMonth(endMonth)}</strong> arasında{" "}
                <strong className="font-medium">{Math.max(monthCount, 0)} aya</strong> bölünecek. 
                Her aya düşen yaklaşık pay:{" "}
                <strong className="font-medium text-slate-900">{formatMoney(monthlyShare, form.currency)}</strong>
              </p>
            )}
          </div>

          {isConfirming ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="font-medium text-sm uppercase tracking-widest text-amber-700 mb-2">
                {form.expenseScope === "season"
                  ? "Sezonluk Gider Dağıtılacak"
                  : "Dönem Gideri Kaydedilecek"}
              </p>
              <p className="text-sm leading-relaxed">
                {form.expenseScope === "season"
                  ? "Bu gider aylara bölünecek ve her dönem sadece kendisine düşen payı alacak."
                  : "Bu gider sadece seçilen dönem sonucuna dahil edilecek."}{" "}
                Devam etmek istiyor musunuz?
              </p>
            </div>
          ) : null}

          {formError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
              {formError}
            </div>
          ) : null}
        </div>

        <div className="flex-none flex items-center justify-end gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            disabled={isSaving}
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving
              ? "Kaydediliyor..."
              : isConfirming
              ? "Onayla ve Kaydet"
              : "Devam Et"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ExpenseDetailModal({
  detail,
  onClose,
  onCancelRequest,
}: {
  detail: ExpenseWithAllocations;
  onClose: () => void;
  onCancelRequest: (expense: ExpenseRead) => void;
}) {
  const expense = detail.expense;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex-none flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
              Gider Detayı
            </p>
            <h3 className="mt-1 text-2xl font-normal text-slate-800">
              {expense.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {getExpenseScopeLabel(expense)} ·{" "}
              {formatDate(expense.expense_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
            <DetailMetric
              title="Tutar"
              value={formatMoney(expense.amount, expense.currency)}
            />
            <DetailMetric title="Kur" value={String(expense.exchange_rate)} />
            <DetailMetric
              title="Ana Para Etkisi"
              value={formatMoney(expense.base_amount)}
            />
            <DetailMetric
              title="Durum"
              value={getExpenseStatusLabel(expense)}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-6">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-2">
              Açıklama
            </p>
            <p className="text-sm leading-relaxed text-slate-700">
              {expense.description ?? "Açıklama yok."}
            </p>
            <p className="mt-4 text-xs font-medium text-slate-400 pt-4 border-t border-slate-200/60">
              Belge No: {expense.document_no ?? "-"}
            </p>
          </div>

          {expense.is_allocated ? (
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-teal-100/50 pb-3">
                <div>
                  <p className="text-sm font-medium text-teal-900">
                    Sezonluk Gider Dağılımı
                  </p>
                  <p className="mt-1 text-xs font-medium text-teal-700">
                    {formatPeriodMonth(expense.allocation_start_month)} -{" "}
                    {formatPeriodMonth(expense.allocation_end_month)}
                  </p>
                </div>
                <span className="rounded-full bg-white border border-teal-200 px-3 py-1 text-xs font-medium text-teal-800 shadow-sm">
                  {detail.allocations.length} ay
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
                {detail.allocations.length === 0 ? (
                  <div className="p-4 text-sm font-medium text-slate-500 text-center">
                    Dağılım kaydı bulunmuyor.
                  </div>
                ) : (
                  detail.allocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-b-0"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {formatPeriodMonth(allocation.period_month)}
                      </span>
                      <span className="text-sm font-medium text-teal-800">
                        {formatMoney(allocation.allocated_base_amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {expense.is_cancelled ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">
              <p className="font-medium text-sm uppercase tracking-widest text-red-700 mb-2">
                Bu gider iptal edilmiş
              </p>
              <p className="text-sm leading-relaxed text-red-800">
                {expense.cancellation_reason ?? "İptal nedeni girilmemiş."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex-none flex items-center justify-end gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
          {!expense.is_cancelled ? (
            <button
              type="button"
              onClick={() => onCancelRequest(expense)}
              className="rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
            >
              Gideri İptal Et
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-lg font-normal text-slate-800">{value}</p>
    </div>
  );
}

function CancelExpenseModal({
  expense,
  onClose,
  onCancelled,
}: {
  expense: ExpenseRead;
  onClose: () => void;
  onCancelled: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (!reason.trim()) {
      setError("İptal nedeni zorunludur.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await cancelExpense(expense.id, {
        cancellation_reason: reason.trim(),
      });
      await onCancelled();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Gider iptal edilemedi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 sm:p-8 text-slate-800 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-red-600">
              Gider İptali
            </p>
            <h3 className="mt-1 text-2xl font-normal text-slate-800">
              {expense.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/50 p-5 text-sm leading-relaxed text-red-800">
          Bu işlem gider kaydını iptal eder. Sezonluk gider ise dağılım
          kayıtları da iptal mantığına göre kapatılır. Devam etmek için iptal
          nedenini yaz.
        </div>

        <label className="mt-6 block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-slate-500">
            İptal Nedeni
          </span>
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-red-400 focus:bg-white"
            placeholder="Örn: Hatalı fatura kaydı girildi."
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
            {error}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            disabled={isSaving}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            disabled={isSaving}
          >
            {isSaving ? "İptal ediliyor..." : "Onayla ve İptal Et"}
          </button>
        </div>
      </div>
    </div>
  );
}

type CollectionFormState = {
  customerId: string;
  eventId: string;
  paymentPlanId: string;
  collectionDate: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  paymentMethod: string;
  receivedLocation: "company" | "partner";
  receivedByPartnerId: string;
  documentNo: string;
  notes: string;
};

function getDefaultCollectionForm(): CollectionFormState {
  return {
    customerId: "",
    eventId: "",
    paymentPlanId: "",
    collectionDate: todayIsoDate(),
    amount: "",
    currency: "TRY",
    exchangeRate: "1",
    paymentMethod: "cash",
    receivedLocation: "company",
    receivedByPartnerId: "",
    documentNo: "",
    notes: "",
  };
}

function getPaymentMethodLabel(value: string) {
  const labels: Record<string, string> = {
    cash: "Nakit",
    bank_transfer: "Banka Havalesi",
    credit_card: "Kredi Kartı",
    cheque: "Çek",
    other: "Diğer",
  };

  return labels[value] ?? value;
}

function CollectionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<CollectionFormState>(() =>
    getDefaultCollectionForm()
  );
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [events, setEvents] = useState<EventRead[]>([]);
  const [partners, setPartners] = useState<PartnerRead[]>([]);
  const [eventPayments, setEventPayments] =
    useState<EventPaymentsDetail | null>(null);

  const [customerReceivableBaseAmount, setCustomerReceivableBaseAmount] =
    useState(0);
  const [isLoadingCustomerBalance, setIsLoadingCustomerBalance] =
    useState(false);

  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [isLoadingEventPayments, setIsLoadingEventPayments] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCustomer =
    customers.find((customer) => String(customer.id) === form.customerId) ??
    null;

  const customerEvents = events.filter(
    (eventItem) => String(eventItem.customer_id) === form.customerId
  );

  const selectedEvent =
    customerEvents.find((eventItem) => String(eventItem.id) === form.eventId) ??
    null;

  const selectedPaymentPlan =
    eventPayments?.payment_plans.find(
      (plan) => String(plan.id) === form.paymentPlanId
    ) ?? null;

  const amount = Number(form.amount || 0);
  const exchangeRate = Number(form.exchangeRate || 1);
  const baseAmount = amount * exchangeRate;

  useEffect(() => {
    async function loadBaseData() {
      try {
        setIsLoadingBaseData(true);
        setFormError(null);

        const [customerList, eventList, partnerList] = await Promise.all([
          fetchCustomers(),
          fetchEvents(),
          fetchPartners(),
        ]);

        setCustomers(customerList);
        setEvents(eventList);
        setPartners(partnerList);

        if (customerList.length > 0) {
          const firstCustomer = customerList[0];
          const firstCustomerEvent = eventList.find(
            (eventItem) => eventItem.customer_id === firstCustomer.id
          );

          setForm((previous) => ({
            ...previous,
            customerId: String(firstCustomer.id),
            eventId: firstCustomerEvent ? String(firstCustomerEvent.id) : "",
            currency: firstCustomer.default_currency || previous.currency,
          }));
        }
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "Tahsilat formu verileri alınamadı."
        );
      } finally {
        setIsLoadingBaseData(false);
      }
    }

    loadBaseData();
  }, []);

  useEffect(() => {
    async function loadCustomerBalance() {
      if (!form.customerId || customerEvents.length === 0) {
        setCustomerReceivableBaseAmount(0);
        return;
      }

      try {
        setIsLoadingCustomerBalance(true);

        const details = await Promise.all(
          customerEvents.map((eventItem) => fetchEventPayments(eventItem.id))
        );

        const totalRemaining = details.reduce(
          (total, detail) =>
            total + Number(detail.summary.remaining_base_amount ?? 0),
          0
        );

        setCustomerReceivableBaseAmount(totalRemaining);
      } catch {
        setCustomerReceivableBaseAmount(0);
      } finally {
        setIsLoadingCustomerBalance(false);
      }
    }

    loadCustomerBalance();
  }, [form.customerId, events]); // eslint-disable-next-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadEventPaymentDetail() {
      if (!form.eventId) {
        setEventPayments(null);
        return;
      }

      try {
        setIsLoadingEventPayments(true);
        setFormError(null);

        const detail = await fetchEventPayments(Number(form.eventId));
        setEventPayments(detail);

        const firstOpenPlan = detail.payment_plans.find(
          (plan) =>
            Number(plan.base_amount ?? 0) - Number(plan.paid_base_amount ?? 0) >
            0
        );

        setForm((previous) => ({
          ...previous,
          paymentPlanId: firstOpenPlan ? String(firstOpenPlan.id) : "",
          amount:
            firstOpenPlan && !previous.amount
              ? String(
                  Math.max(
                    0,
                    Number(firstOpenPlan.base_amount ?? 0) -
                      Number(firstOpenPlan.paid_base_amount ?? 0)
                  )
                )
              : previous.amount,
          currency: firstOpenPlan?.currency ?? previous.currency,
          exchangeRate: firstOpenPlan
            ? String(firstOpenPlan.exchange_rate)
            : previous.exchangeRate,
        }));
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "Etkinlik ödeme bilgileri alınamadı."
        );
      } finally {
        setIsLoadingEventPayments(false);
      }
    }

    loadEventPaymentDetail();
  }, [form.eventId]);

  function updateForm<K extends keyof CollectionFormState>(
    key: K,
    value: CollectionFormState[K]
  ) {
    setForm((previous) => {
      const nextForm: CollectionFormState = {
        ...previous,
        [key]: value,
      };

      if (key === "customerId") {
        const matchingEvents = events.filter(
          (eventItem) => String(eventItem.customer_id) === String(value)
        );
        const selectedCustomerForCurrency = customers.find(
          (customer) => String(customer.id) === String(value)
        );

        nextForm.eventId =
          matchingEvents.length > 0 ? String(matchingEvents[0].id) : "";
        nextForm.paymentPlanId = "";
        nextForm.amount = "";
        nextForm.currency =
          selectedCustomerForCurrency?.default_currency || previous.currency;
      }

      if (key === "eventId") {
        nextForm.paymentPlanId = "";
        nextForm.amount = "";
      }

      if (key === "receivedLocation" && value === "company") {
        nextForm.receivedByPartnerId = "";
      }

      return nextForm;
    });

    setIsConfirming(false);
    setFormError(null);
  }

  function validateForm() {
    if (!form.customerId) {
      return "Müşteri seçimi zorunludur.";
    }

    if (!form.eventId) {
      return "Seçilen müşteriye ait etkinlik bulunmalı ve seçilmelidir.";
    }

    if (!form.collectionDate) {
      return "Tahsilat tarihi zorunludur.";
    }

    if (!amount || amount <= 0) {
      return "Tahsilat tutarı sıfırdan büyük olmalıdır.";
    }

    if (!exchangeRate || exchangeRate <= 0) {
      return "Kur sıfırdan büyük olmalıdır.";
    }

    if (form.receivedLocation === "partner" && !form.receivedByPartnerId) {
      return "Tahsilatı alan ortak seçilmelidir.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      const payload: CreateCollectionPayload = {
        payment_plan_id: form.paymentPlanId ? Number(form.paymentPlanId) : null,
        received_by_partner_id:
          form.receivedLocation === "partner" && form.receivedByPartnerId
            ? Number(form.receivedByPartnerId)
            : null,
        collection_date: form.collectionDate,
        amount,
        currency: form.currency,
        exchange_rate: exchangeRate,
        payment_method: form.paymentMethod,
        document_no: form.documentNo.trim() || null,
        notes: form.notes.trim() || null,
      };

      await createCollection(Number(form.eventId), payload);
      await onSaved();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Tahsilat kaydedilemedi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl"
      >
        <div className="flex-none flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
              Tahsilat İşlemi
            </p>
            <h3 className="mt-1 text-2xl font-normal text-slate-800">
              Tahsilat Gir
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Önce müşteri seç, sonra o müşteriye ait etkinliği ve ödeme planını belirle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoadingBaseData ? (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
              Tahsilat formu hazırlanıyor...
            </div>
          ) : null}

          <div className="mb-6 rounded-[1.5rem] border border-red-200 bg-red-50/50 p-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-red-600 mb-1">
                  Bu Müşteriden Toplam Alacağınız
                </p>
                <p className="text-sm font-medium text-red-900">
                  {selectedCustomer
                    ? selectedCustomer.name
                    : "Müşteri seçilmedi"}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-3xl sm:text-4xl font-normal tracking-tight text-red-700">
                  {isLoadingCustomerBalance
                    ? "..."
                    : formatMoney(customerReceivableBaseAmount)}
                </p>
                <p className="mt-1 text-[11px] font-medium text-red-600 opacity-80">
                  Açık etkinlik ve ödeme planı bakiyeleri toplamı
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Müşteri">
              <select
                value={form.customerId}
                onChange={(event) =>
                  updateForm("customerId", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
              >
                {customers.length === 0 ? (
                  <option value="">Müşteri bulunamadı</option>
                ) : (
                  customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.short_name ? ` · ${customer.short_name}` : ""}
                    </option>
                  ))
                )}
              </select>
            </FormField>

            <FormField label="Etkinlik">
              <select
                value={form.eventId}
                onChange={(event) => updateForm("eventId", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                disabled={!form.customerId || customerEvents.length === 0}
              >
                {customerEvents.length === 0 ? (
                  <option value="">
                    Bu müşteriye ait etkinlik bulunamadı
                  </option>
                ) : (
                  customerEvents.map((eventItem) => (
                    <option key={eventItem.id} value={eventItem.id}>
                      {eventItem.title} · {formatDate(eventItem.event_date)}
                    </option>
                  ))
                )}
              </select>
            </FormField>

            <FormField label="Ödeme Planı">
              <select
                value={form.paymentPlanId}
                onChange={(event) =>
                  updateForm("paymentPlanId", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                disabled={!eventPayments || isLoadingEventPayments}
              >
                <option value="">Plana bağlama / serbest tahsilat</option>
                {eventPayments?.payment_plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} · Kalan{" "}
                    {formatMoney(
                      Math.max(
                        0,
                        Number(plan.base_amount ?? 0) -
                          Number(plan.paid_base_amount ?? 0)
                      ),
                      plan.currency
                    )}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Tahsilat Tarihi">
              <input
                type="date"
                value={form.collectionDate}
                onChange={(event) =>
                  updateForm("collectionDate", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
              />
            </FormField>

            <FormField label="Tutar">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="0.00"
              />
            </FormField>

            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <FormField label="Para Birimi">
                <select
                  value={form.currency}
                  onChange={(event) =>
                    updateForm("currency", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                >
                  <option value="TRY">TRY</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </FormField>

              <FormField label="Kur">
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={form.exchangeRate}
                  onChange={(event) =>
                    updateForm("exchangeRate", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                />
              </FormField>
            </div>

            <FormField label="Ödeme Yöntemi">
              <select
                value={form.paymentMethod}
                onChange={(event) =>
                  updateForm("paymentMethod", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
              >
                <option value="cash">Nakit</option>
                <option value="bank_transfer">Banka Havalesi</option>
                <option value="credit_card">Kredi Kartı</option>
                <option value="cheque">Çek</option>
                <option value="other">Diğer</option>
              </select>
            </FormField>

            <FormField label="Tahsilat Yeri">
              <select
                value={form.receivedLocation}
                onChange={(event) =>
                  updateForm(
                    "receivedLocation",
                    event.target.value as "company" | "partner"
                  )
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
              >
                <option value="company">Şirket Kasası / Bankası</option>
                <option value="partner">Ortak Üzerinde</option>
              </select>
            </FormField>

            {form.receivedLocation === "partner" ? (
              <FormField label="Tahsilatı Alan Ortak">
                <select
                  value={form.receivedByPartnerId}
                  onChange={(event) =>
                    updateForm("receivedByPartnerId", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                >
                  <option value="">Ortak seç</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

            <FormField label="Belge No">
              <input
                value={form.documentNo}
                onChange={(event) =>
                  updateForm("documentNo", event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="Makbuz / dekont no"
              />
            </FormField>
          </div>

          <div className="mt-5">
            <FormField label="Not">
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white"
                placeholder="Tahsilat notu"
              />
            </FormField>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              İşlem Özeti
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {selectedCustomer ? (
                <strong className="font-medium text-slate-900">
                  {selectedCustomer.name}
                </strong>
              ) : (
                "Seçili müşteri"
              )}{" "}
              /{" "}
              {selectedEvent ? (
                <strong className="font-medium text-slate-900">
                  {selectedEvent.title}
                </strong>
              ) : (
                "seçili etkinlik"
              )}{" "}
              için{" "}
              <strong className="font-medium text-slate-900">
                {formatMoney(baseAmount, form.currency)}
              </strong>{" "}
              tahsilat kaydı oluşturulacak. Tahsilat yeri:{" "}
              <strong className="font-medium text-slate-900">
                {form.receivedLocation === "partner"
                  ? "Ortak üzerinde"
                  : "Şirket kasası / bankası"}
              </strong>
              . Ödeme yöntemi:{" "}
              <strong className="font-medium text-slate-900">
                {getPaymentMethodLabel(form.paymentMethod)}
              </strong>
              .
            </p>
            {selectedPaymentPlan ? (
              <p className="mt-3 text-[11px] font-medium text-slate-600 bg-slate-200/50 border border-slate-200 inline-block px-3 py-1.5 rounded-full">
                Bağlı ödeme planı: {selectedPaymentPlan.title}
              </p>
            ) : null}
          </div>

          {isConfirming ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="font-medium text-sm uppercase tracking-widest text-amber-700 mb-2">
                Tahsilat Kaydedilecek
              </p>
              <p className="text-sm leading-relaxed">
                Bu işlem seçilen müşterinin seçilen etkinlik alacağını azaltır.
                Şirket kasasına alındıysa şirket nakdi artar; ortak üzerinde
                kaldıysa ortak üzerindeki şirket parası olarak takip edilir.
                Devam etmek istiyor musunuz?
              </p>
            </div>
          ) : null}

          {formError ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
              {formError}
            </div>
          ) : null}
        </div>

        <div className="flex-none flex items-center justify-end gap-3 border-t border-slate-100 p-6 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            disabled={isSaving}
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            disabled={isSaving || isLoadingBaseData}
          >
            {isSaving
              ? "Kaydediliyor..."
              : isConfirming
              ? "Onayla ve Kaydet"
              : "Devam Et"}
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
