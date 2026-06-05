import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

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

type FinanceCenterPageProps = {
  onBackToDashboard: () => void;
};

type QuickActionKey =
  | "collection"
  | "expense"
  | "supplierPayment"
  | "partnerCash"
  | "carryForward"
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
    title: "Gider Faturası Gir",
    description: "Normal dönem gideri veya sezonluk gider kaydet.",
    helper: "Sezonluk giderler aylara otomatik bölünür.",
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
    key: "periodClose",
    title: "Dönem Kapanışı",
    description: "Ay sonu kontrolünü yap ve dönemi kilitle.",
    helper: "Açık kalemler sonraki döneme devredilir.",
    icon: "■",
    tone: "dark",
    warningTitle: "Dönem Kapatılacak",
    warningMessage:
      "Bu dönem kapatılırsa açık müşteri alacakları, sanatçı/hizmet borçları, ortak üzerindeki paralar ve açık etkinlikler sonraki döneme devredilir. Kapanan döneme normal işlem girilemez.",
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
  const year = value && value.length >= 4 ? value.slice(0, 4) : String(new Date().getFullYear());
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

function formatMoney(value: number | string | null | undefined, currency = "TL") {
  const safeValue = Number(value ?? 0);

  return (
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue) + ` ${currency}`
  );
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
  return expense.is_allocated ? "Sezonluk Gider" : "Normal Dönem Gideri";
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
    return "border-teal-200 bg-teal-300 text-slate-950 shadow-teal-100";
  }

  if (tone === "dark") {
    return "border-slate-800 bg-slate-950 text-white shadow-slate-300";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-100 text-amber-950 shadow-amber-100";
  }

  return "border-slate-200 bg-white text-slate-950 shadow-slate-200";
}

export function FinanceCenterPage({ onBackToDashboard }: FinanceCenterPageProps) {
  const currentPeriodMonth = useMemo(() => getCurrentPeriodMonth(), []);
  const [summary, setSummary] = useState<FinancialMovementSummary>(defaultSummary);
  const [periodExpenseSummary, setPeriodExpenseSummary] =
    useState<PeriodExpenseSummary | null>(null);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [carryForwards, setCarryForwards] = useState<CarryForwardItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithAllocations | null>(null);
  const [isExpenseDetailLoading, setIsExpenseDetailLoading] = useState(false);
  const [expenseDetailError, setExpenseDetailError] = useState<string | null>(null);
  const [cancelExpenseTarget, setCancelExpenseTarget] = useState<ExpenseRead | null>(null);

  async function loadDashboard() {
    setIsLoading(true);
    setLoadError(null);

    const results = await Promise.allSettled([
      fetchFinanceSummary(),
      fetchRecentFinanceMovements(),
      fetchOpenCarryForwards(),
      fetchPeriodExpenseSummary(currentPeriodMonth),
      fetchExpenses(),
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

    const rejected = results.filter((item) => item.status === "rejected");

    if (rejected.length > 0) {
      setLoadError("Bazı finans verileri alınamadı. Sayfa çalışmaya devam ediyor.");
    }

    setIsLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, [currentPeriodMonth]);

  const openCarryForwardTotal = carryForwards.reduce(
    (total, item) => total + Number(item.remaining_base_amount ?? 0),
    0
  );

  const partnerCashOnHandTotal = carryForwards
    .filter((item) => item.carry_type === "partner_cash_on_hand")
    .reduce((total, item) => total + Number(item.remaining_base_amount ?? 0), 0);

  const supplierPayableTotal = carryForwards
    .filter((item) => item.carry_type === "supplier_payable")
    .reduce((total, item) => total + Number(item.remaining_base_amount ?? 0), 0);

  const customerReceivableTotal = carryForwards
    .filter((item) => item.carry_type === "customer_receivable")
    .reduce((total, item) => total + Number(item.remaining_base_amount ?? 0), 0);

  const cashBalance = summary.company_cash_in_base_amount - summary.company_cash_out_base_amount;

  function handleQuickAction(action: QuickAction) {
    if (action.key === "collection") {
      setShowCollectionModal(true);
      return;
    }

    if (action.key === "expense") {
      setShowExpenseModal(true);
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
      setExpenseDetailError(error instanceof Error ? error.message : "Gider detayı alınamadı.");
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
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <button
              onClick={onBackToDashboard}
              className="text-sm font-black text-slate-500 transition hover:text-slate-950"
            >
              ← Back Office
            </button>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Finans Merkezi
              </h1>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">
                Ön Muhasebe Paneli
              </span>
            </div>
          </div>

          <div className="hidden rounded-2xl bg-slate-950 px-4 py-3 text-right text-white sm:block">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">
              Aktif Dönem
            </p>
            <p className="text-lg font-black">{currentPeriodMonth}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300 lg:p-7">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-300">
            VIA EVENTS
          </p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="max-w-4xl text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                Finans Merkezi
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 sm:text-base">
                Tahsilat, ödeme, gider, cari, devir ve dönem kontrolü için günlük muhasebe paneli.
              </p>
            </div>
            <span className="w-fit rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-teal-200">
              Uyarılar işlem anında gösterilir
            </span>
          </div>
        </div>

        {loadError ? (
          <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="font-black">Bilgi</p>
            <p className="mt-2 text-sm leading-6">{loadError}</p>
          </div>
        ) : null}

        {expenseDetailError ? (
          <div className="mt-5 rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-red-950">
            <p className="font-black">Gider Detayı Açılamadı</p>
            <p className="mt-2 text-sm leading-6">{expenseDetailError}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-5 rounded-[1.5rem] bg-white p-5 text-sm font-bold text-slate-500 shadow-lg shadow-slate-200">
            Finans Merkezi verileri yükleniyor...
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            title="Bu Ay Gider Payı"
            value={formatMoney(periodExpenseSummary?.total_period_expense_base_amount ?? 0)}
            description="Normal + sezonluk gider payı"
            tone="dark"
          />
        </div>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                Günlük İşler
              </p>
              <h3 className="mt-1 text-2xl font-black">Bugün yapılacaklar</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
              Sistem yönlendirmesi
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <TodoRow
              title="Bekleyen tahsilatlar"
              value={formatMoney(customerReceivableTotal)}
              description="Devreden müşteri alacakları takip edilmeli."
              status={customerReceivableTotal > 0 ? "Takip gerekli" : "Temiz"}
            />
            <TodoRow
              title="Ödenecek sanatçı / hizmet borçları"
              value={formatMoney(supplierPayableTotal)}
              description="Açık borçlar kapanmadan etkinlik finans kapanışı tamamlanamaz."
              status={supplierPayableTotal > 0 ? "Ödeme bekliyor" : "Temiz"}
            />
            <TodoRow
              title="Ortak üzerindeki paralar"
              value={formatMoney(partnerCashOnHandTotal)}
              description="Ortağın aldığı tahsilatlar şirkete teslim edilmeli."
              status={partnerCashOnHandTotal > 0 ? "Teslim bekliyor" : "Temiz"}
            />
            <TodoRow
              title="Bu ay sezonluk gider payı"
              value={formatMoney(periodExpenseSummary?.allocated_expense_base_amount ?? 0)}
              description="Geçmişten gelen sezonluk gider payı dönem sonucuna dahil edilir."
              status={(periodExpenseSummary?.allocation_count ?? 0) > 0 ? "Dağıtım var" : "Yok"}
            />
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                Hızlı İşlemler
              </p>
              <h3 className="mt-1 text-2xl font-black">Muhasebe işlemleri</h3>
            </div>
            <span className="rounded-full bg-teal-50 px-3 py-2 text-xs font-black text-teal-700">
              Her kritik işlemde onay sorusu
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => handleQuickAction(action)}
                className={`rounded-[1.5rem] border p-5 text-left shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${getToneClasses(
                  action.tone
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-xl font-black text-white">
                    {action.icon}
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] opacity-60">
                    İşlem
                  </span>
                </div>
                <p className="mt-5 text-xl font-black">{action.title}</p>
                <p className="mt-2 text-sm leading-6 opacity-75">{action.description}</p>
                <p className="mt-4 text-xs font-black opacity-70">{action.helper}</p>
              </button>
            ))}
          </div>
        </section>

        <ExpenseRecordsSection
          expenses={expenses}
          isDetailLoading={isExpenseDetailLoading}
          currentPeriodMonth={currentPeriodMonth}
          onOpenDetail={openExpenseDetail}
        />

        <div className="mt-6 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Devreden Kalemler
                </p>
                <h3 className="mt-1 text-2xl font-black">Açık işler</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                {carryForwards.length} kayıt
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {carryForwards.length === 0 ? (
                <EmptyState text="Açık devreden kalem bulunmuyor." />
              ) : (
                carryForwards.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{getCarryTypeLabel(item.carry_type)}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {item.source_period_month ?? "-"} → {item.target_period_month ?? "-"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">
                        {formatMoney(item.remaining_base_amount, item.currency)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {item.carry_reason}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  Son Finans Hareketleri
                </p>
                <h3 className="mt-1 text-2xl font-black">Denetim izi</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                {summary.total_count} toplam
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {movements.length === 0 ? (
                <EmptyState text="Henüz finans hareketi bulunmuyor." />
              ) : (
                movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{movement.title}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {getMovementLabel(movement.movement_type)} · {movement.movement_date}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          movement.direction === "in"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {movement.direction === "in" ? "+" : "-"}
                        {formatMoney(movement.base_amount, movement.currency)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {movement.description ?? "Açıklama yok."}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </section>

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

      {showExpenseModal ? (
        <ExpenseModal
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
    </main>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  tone: "dark" | "teal" | "white" | "amber";
};

function SummaryCard({ title, value, description, tone }: SummaryCardProps) {
  const classes =
    tone === "dark"
      ? "bg-slate-950 text-white"
      : tone === "teal"
        ? "bg-teal-300 text-slate-950"
        : tone === "amber"
          ? "bg-amber-100 text-amber-950"
          : "bg-white text-slate-950";

  return (
    <article className={`rounded-[1.5rem] p-5 shadow-lg shadow-slate-200 ${classes}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-60">
        {title}
      </p>
      <p className="mt-4 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-sm leading-6 opacity-70">{description}</p>
    </article>
  );
}

type TodoRowProps = {
  title: string;
  value: string;
  description: string;
  status: string;
};

function TodoRow({ title, value, description, status }: TodoRowProps) {
  return (
    <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="text-right">
          <p className="font-black">{value}</p>
          <p className="mt-1 text-xs font-black text-teal-700">{status}</p>
        </div>
      </div>
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
  const [periodFilter, setPeriodFilter] = useState(currentPeriodMonth);
  const [scopeFilter, setScopeFilter] = useState<"all" | "period" | "season">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "cancelled" | "all">("active");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);

      return matchesPeriod && matchesScope && matchesStatus && matchesSearch;
    });
  }, [expenses, periodFilter, scopeFilter, statusFilter, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const visibleExpenses = filteredExpenses.slice(pageStartIndex, pageStartIndex + pageSize);

  const activeExpenses = filteredExpenses.filter((expense) => !expense.is_cancelled);
  const cancelledExpenses = filteredExpenses.filter((expense) => expense.is_cancelled);
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
    <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Gider Kayıtları
          </p>
          <h3 className="mt-1 text-2xl font-black">Gider takip ekranı</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Giderler dönem, tür, durum ve arama filtresiyle kontrollü listelenir.
          </p>
        </div>
        <div className="rounded-[1.25rem] bg-slate-950 px-4 py-3 text-right text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
            Filtrelenmiş Aktif Toplam
          </p>
          <p className="text-lg font-black">{formatMoney(activeTotal)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniMetric title="Filtrelenmiş Kayıt" value={String(filteredExpenses.length)} />
        <MiniMetric
          title="Aktif / İptal"
          value={`${activeExpenses.length} / ${cancelledExpenses.length}`}
        />
        <MiniMetric
          title="Sezonluk"
          value={String(filteredExpenses.filter((expense) => expense.is_allocated).length)}
        />
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
            Gider Türü
          </span>
          <select
            value={scopeFilter}
            onChange={(event) =>
              changeScopeFilter(event.target.value as "all" | "period" | "season")
            }
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
          >
            <option value="all">Tümü</option>
            <option value="period">Normal Dönem</option>
            <option value="season">Sezonluk</option>
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
            placeholder="Başlık, belge no, açıklama ara"
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

      <div className="mt-5 space-y-3">
        {visibleExpenses.length === 0 ? (
          <EmptyState text="Bu filtrelere uygun gider kaydı bulunmuyor." />
        ) : (
          visibleExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`rounded-[1.25rem] border p-4 ${
                expense.is_cancelled
                  ? "border-red-100 bg-red-50"
                  : "border-slate-100 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black">{expense.title}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        expense.is_allocated
                          ? "bg-teal-100 text-teal-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {getExpenseScopeLabel(expense)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        expense.is_cancelled
                          ? "bg-red-100 text-red-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {getExpenseStatusLabel(expense)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-bold text-slate-500">
                    {formatDate(expense.expense_date)} · Belge: {expense.document_no ?? "-"}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {expense.description ?? "Açıklama yok."}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-black">
                    {formatMoney(expense.base_amount, expense.currency)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenDetail(expense.id)}
                    disabled={isDetailLoading}
                    className="mt-3 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Detay Aç
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-500">
          {filteredExpenses.length === 0
            ? "Kayıt yok"
            : `${pageStartIndex + 1} - ${Math.min(
                pageStartIndex + pageSize,
                filteredExpenses.length
              )} / ${filteredExpenses.length} kayıt`}
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
          <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
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
    </section>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              İşlem Öncesi Uyarı
            </p>
            <h3 className="mt-2 text-2xl font-black">{action.warningTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-600">
          {action.warningMessage}
        </p>

        <div className="mt-6 rounded-[1.25rem] bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          Bu işlem formu sonraki adımda bağlanacak. Gider faturası formu ve gider kayıt listesi artık canlı çalışıyor.
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
          >
            Vazgeç
          </button>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
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
  const [form, setForm] = useState<ExpenseFormState>(() => getDefaultExpenseForm());
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const amount = Number(form.amount || 0);
  const exchangeRate = Number(form.exchangeRate || 1);
  const baseAmount = amount * exchangeRate;
  const startMonth = getPeriodMonthFromDate(form.expenseDate);
  const endMonth =
    form.expenseScope === "season" ? form.allocationEndMonth || getYearEndMonth(form.expenseDate) : startMonth;
  const monthCount = form.expenseScope === "season" ? getMonthCount(startMonth, endMonth) : 1;
  const monthlyShare = monthCount > 0 ? baseAmount / monthCount : 0;

  function updateForm<K extends keyof ExpenseFormState>(key: K, value: ExpenseFormState[K]) {
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
      setFormError(error instanceof Error ? error.message : "Gider kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Gider İşlemi
            </p>
            <h3 className="mt-2 text-2xl font-black">Gider Faturası Gir</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Normal dönem gideri ya da sezonluk gider olarak kaydedebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => updateForm("expenseScope", "period")}
            className={`rounded-[1.25rem] border p-4 text-left ${
              form.expenseScope === "period"
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-slate-50 text-slate-950"
            }`}
          >
            <p className="font-black">Normal Dönem Gideri</p>
            <p className="mt-2 text-sm leading-6 opacity-70">
              Gider sadece seçilen ayın sonucuna dahil edilir.
            </p>
          </button>

          <button
            type="button"
            onClick={() => updateForm("expenseScope", "season")}
            className={`rounded-[1.25rem] border p-4 text-left ${
              form.expenseScope === "season"
                ? "border-teal-300 bg-teal-300 text-slate-950"
                : "border-slate-200 bg-slate-50 text-slate-950"
            }`}
          >
            <p className="font-black">Sezonluk Gider</p>
            <p className="mt-2 text-sm leading-6 opacity-70">
              Gider başlangıç ayından sezon sonuna kadar aylara bölünür.
            </p>
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormField label="Gider Başlığı">
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="Örn: Sezon reklam gideri"
            />
          </FormField>

          <FormField label="Gider Tarihi">
            <input
              type="date"
              value={form.expenseDate}
              onChange={(event) => updateForm("expenseDate", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
            />
          </FormField>

          <FormField label="Tutar">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="0.00"
            />
          </FormField>

          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <FormField label="Para Birimi">
              <select
                value={form.currency}
                onChange={(event) => updateForm("currency", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
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
                onChange={(event) => updateForm("exchangeRate", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              />
            </FormField>
          </div>

          {form.expenseScope === "season" ? (
            <FormField label="Sezon Bitiş Ayı">
              <input
                type="month"
                value={form.allocationEndMonth}
                onChange={(event) => updateForm("allocationEndMonth", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              />
            </FormField>
          ) : null}

          <FormField label="Belge No">
            <input
              value={form.documentNo}
              onChange={(event) => updateForm("documentNo", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="Fatura / belge no"
            />
          </FormField>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Açıklama">
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="Gider açıklaması"
            />
          </FormField>

          <FormField label="Not">
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="İç not"
            />
          </FormField>
        </div>

        <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-700">İşlem Özeti</p>
          {form.expenseScope === "period" ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Bu gider <strong>{formatPeriodMonth(startMonth)}</strong> dönemine
              normal gider olarak yazılacak. Toplam etki:{" "}
              <strong>{formatMoney(baseAmount, form.currency)}</strong>
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Bu sezonluk gider <strong>{formatPeriodMonth(startMonth)}</strong> -{" "}
              <strong>{formatPeriodMonth(endMonth)}</strong> arasında{" "}
              <strong>{Math.max(monthCount, 0)} aya</strong> bölünecek. Her aya düşen
              yaklaşık pay: <strong>{formatMoney(monthlyShare, form.currency)}</strong>
            </p>
          )}
        </div>

        {isConfirming ? (
          <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-black">
              {form.expenseScope === "season"
                ? "Sezonluk Gider Aylara Dağıtılacak"
                : "Normal Dönem Gideri Kaydedilecek"}
            </p>
            <p className="mt-2 text-sm leading-6">
              {form.expenseScope === "season"
                ? "Bu gider aylara bölünecek ve her dönem sadece kendisine düşen payı alacak."
                : "Bu gider sadece seçilen dönem sonucuna dahil edilecek."}
              {" "}Devam etmek istiyor musunuz?
            </p>
          </div>
        ) : null}

        {formError ? (
          <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
            {formError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
            disabled={isSaving}
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Gider Detayı
            </p>
            <h3 className="mt-2 text-2xl font-black">{expense.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {getExpenseScopeLabel(expense)} · {formatDate(expense.expense_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <DetailMetric title="Tutar" value={formatMoney(expense.amount, expense.currency)} />
          <DetailMetric title="Kur" value={String(expense.exchange_rate)} />
          <DetailMetric title="Ana Para Etkisi" value={formatMoney(expense.base_amount)} />
          <DetailMetric title="Durum" value={getExpenseStatusLabel(expense)} />
        </div>

        <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-700">Açıklama</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {expense.description ?? "Açıklama yok."}
          </p>
          <p className="mt-3 text-xs font-bold text-slate-400">
            Belge No: {expense.document_no ?? "-"}
          </p>
        </div>

        {expense.is_allocated ? (
          <div className="mt-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-teal-900">Sezonluk Gider Dağılımı</p>
                <p className="mt-1 text-xs font-bold text-teal-700">
                  {formatPeriodMonth(expense.allocation_start_month)} -{" "}
                  {formatPeriodMonth(expense.allocation_end_month)}
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-teal-800">
                {detail.allocations.length} ay
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-teal-100 bg-white">
              {detail.allocations.length === 0 ? (
                <div className="p-4 text-sm font-bold text-slate-500">
                  Dağılım kaydı bulunmuyor.
                </div>
              ) : (
                detail.allocations.map((allocation) => (
                  <div
                    key={allocation.id}
                    className="flex items-center justify-between border-b border-teal-50 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-sm font-black">
                      {formatPeriodMonth(allocation.period_month)}
                    </span>
                    <span className="text-sm font-black text-teal-800">
                      {formatMoney(allocation.allocated_base_amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {expense.is_cancelled ? (
          <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-red-950">
            <p className="font-black">Bu gider iptal edilmiş.</p>
            <p className="mt-2 text-sm leading-6">
              {expense.cancellation_reason ?? "İptal nedeni girilmemiş."}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {!expense.is_cancelled ? (
            <button
              type="button"
              onClick={() => onCancelRequest(expense)}
              className="rounded-full bg-red-100 px-5 py-3 text-sm font-black text-red-800"
            >
              Gideri İptal Et
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
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
      setError(cancelError instanceof Error ? cancelError.message : "Gider iptal edilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
              Gider İptali
            </p>
            <h3 className="mt-2 text-2xl font-black">{expense.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        <div className="mt-5 rounded-[1.25rem] bg-red-50 p-4 text-sm leading-6 text-red-950">
          Bu işlem gider kaydını iptal eder. Sezonluk gider ise dağılım kayıtları da iptal mantığına göre kapatılır.
          Devam etmek için iptal nedenini yaz.
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            İptal Nedeni
          </span>
          <textarea
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(null);
            }}
            className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-red-400"
            placeholder="Örn: Hatalı fatura kaydı girildi."
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
            disabled={isSaving}
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
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
  const [form, setForm] = useState<CollectionFormState>(() => getDefaultCollectionForm());
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [events, setEvents] = useState<EventRead[]>([]);
  const [partners, setPartners] = useState<PartnerRead[]>([]);
  const [eventPayments, setEventPayments] = useState<EventPaymentsDetail | null>(null);
  const [customerReceivableBaseAmount, setCustomerReceivableBaseAmount] = useState(0);
  const [isLoadingCustomerBalance, setIsLoadingCustomerBalance] = useState(false);
  const [isLoadingBaseData, setIsLoadingBaseData] = useState(true);
  const [isLoadingEventPayments, setIsLoadingEventPayments] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCustomer =
    customers.find((customer) => String(customer.id) === form.customerId) ?? null;

  const customerEvents = events.filter(
    (eventItem) => String(eventItem.customer_id) === form.customerId
  );

  const selectedEvent = customerEvents.find((eventItem) => String(eventItem.id) === form.eventId) ?? null;

  const selectedPaymentPlan =
    eventPayments?.payment_plans.find((plan) => String(plan.id) === form.paymentPlanId) ?? null;

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
        setFormError(error instanceof Error ? error.message : "Tahsilat formu verileri alınamadı.");
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
          (total, detail) => total + Number(detail.summary.remaining_base_amount ?? 0),
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
  }, [form.customerId, events]);

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
          (plan) => Number(plan.base_amount ?? 0) - Number(plan.paid_base_amount ?? 0) > 0
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
          exchangeRate: firstOpenPlan ? String(firstOpenPlan.exchange_rate) : previous.exchangeRate,
        }));
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Etkinlik ödeme bilgileri alınamadı.");
      } finally {
        setIsLoadingEventPayments(false);
      }
    }

    loadEventPaymentDetail();
  }, [form.eventId]);

  function updateForm<K extends keyof CollectionFormState>(key: K, value: CollectionFormState[K]) {
    setForm((previous) => {
      const nextForm: CollectionFormState = {
        ...previous,
        [key]: value,
      };

      if (key === "customerId") {
        const matchingEvents = events.filter((eventItem) => String(eventItem.customer_id) === String(value));
        const selectedCustomerForCurrency = customers.find((customer) => String(customer.id) === String(value));

        nextForm.eventId = matchingEvents.length > 0 ? String(matchingEvents[0].id) : "";
        nextForm.paymentPlanId = "";
        nextForm.amount = "";
        nextForm.currency = selectedCustomerForCurrency?.default_currency || previous.currency;
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
      setFormError(error instanceof Error ? error.message : "Tahsilat kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Tahsilat İşlemi
            </p>
            <h3 className="mt-2 text-2xl font-black">Tahsilat Gir</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Önce müşteri seç, sonra o müşteriye ait etkinliği ve ödeme planını belirle.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        {isLoadingBaseData ? (
          <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4 text-sm font-bold text-slate-500">
            Tahsilat formu hazırlanıyor...
          </div>
        ) : null}

        <div className="mt-5 rounded-[1.75rem] border border-red-100 bg-red-50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-red-700">
                Bu Müşteriden Toplam Alacağınız
              </p>
              <p className="mt-2 text-sm font-bold text-red-900">
                {selectedCustomer ? selectedCustomer.name : "Müşteri seçilmedi"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black tracking-tight text-red-700 sm:text-5xl">
                {isLoadingCustomerBalance ? "..." : formatMoney(customerReceivableBaseAmount)}
              </p>
              <p className="mt-1 text-xs font-bold text-red-600">
                Açık etkinlik ve ödeme planı bakiyeleri toplamı
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormField label="Müşteri">
            <select
              value={form.customerId}
              onChange={(event) => updateForm("customerId", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
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
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              disabled={!form.customerId || customerEvents.length === 0}
            >
              {customerEvents.length === 0 ? (
                <option value="">Bu müşteriye ait etkinlik bulunamadı</option>
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
              onChange={(event) => updateForm("paymentPlanId", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              disabled={!eventPayments || isLoadingEventPayments}
            >
              <option value="">Plana bağlama / serbest tahsilat</option>
              {eventPayments?.payment_plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title} · Kalan{" "}
                  {formatMoney(
                    Math.max(0, Number(plan.base_amount ?? 0) - Number(plan.paid_base_amount ?? 0)),
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
              onChange={(event) => updateForm("collectionDate", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
            />
          </FormField>

          <FormField label="Tutar">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="0.00"
            />
          </FormField>

          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <FormField label="Para Birimi">
              <select
                value={form.currency}
                onChange={(event) => updateForm("currency", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
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
                onChange={(event) => updateForm("exchangeRate", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              />
            </FormField>
          </div>

          <FormField label="Ödeme Yöntemi">
            <select
              value={form.paymentMethod}
              onChange={(event) => updateForm("paymentMethod", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
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
                updateForm("receivedLocation", event.target.value as "company" | "partner")
              }
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
            >
              <option value="company">Şirket Kasası / Bankası</option>
              <option value="partner">Ortak Üzerinde</option>
            </select>
          </FormField>

          {form.receivedLocation === "partner" ? (
            <FormField label="Tahsilatı Alan Ortak">
              <select
                value={form.receivedByPartnerId}
                onChange={(event) => updateForm("receivedByPartnerId", event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
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
              onChange={(event) => updateForm("documentNo", event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="Makbuz / dekont no"
            />
          </FormField>
        </div>

        <div className="mt-4">
          <FormField label="Not">
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
              placeholder="Tahsilat notu"
            />
          </FormField>
        </div>

        <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-700">İşlem Özeti</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {selectedCustomer ? <strong>{selectedCustomer.name}</strong> : "Seçili müşteri"} /{" "}
            {selectedEvent ? <strong>{selectedEvent.title}</strong> : "seçili etkinlik"} için{" "}
            <strong>{formatMoney(baseAmount, form.currency)}</strong> tahsilat kaydı oluşturulacak.
            Tahsilat yeri:{" "}
            <strong>
              {form.receivedLocation === "partner" ? "Ortak üzerinde" : "Şirket kasası / bankası"}
            </strong>
            . Ödeme yöntemi: <strong>{getPaymentMethodLabel(form.paymentMethod)}</strong>.
          </p>
          {selectedPaymentPlan ? (
            <p className="mt-2 text-xs font-bold text-slate-500">
              Bağlı ödeme planı: {selectedPaymentPlan.title}
            </p>
          ) : null}
        </div>

        {isConfirming ? (
          <div className="mt-5 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-black">Tahsilat Kaydedilecek</p>
            <p className="mt-2 text-sm leading-6">
              Bu işlem seçilen müşterinin seçilen etkinlik alacağını azaltır. Şirket kasasına alındıysa şirket nakdi artar;
              ortak üzerinde kaldıysa ortak üzerindeki şirket parası olarak takip edilir.
              Devam etmek istiyor musunuz?
            </p>
          </div>
        ) : null}

        {formError ? (
          <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
            {formError}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
            disabled={isSaving}
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
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
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
