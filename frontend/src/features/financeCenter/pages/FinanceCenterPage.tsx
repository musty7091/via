import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

import {
  createExpense,
  fetchFinanceSummary,
  fetchOpenCarryForwards,
  fetchPeriodExpenseSummary,
  fetchRecentFinanceMovements,
} from "../api/financeCenterApi";
import type {
  CarryForwardItem,
  CreateExpensePayload,
  FinancialMovement,
  FinancialMovementSummary,
  PeriodExpenseSummary,
} from "../types/financeCenterTypes";

type FinanceCenterPageProps = {
  onBackToDashboard: () => void;
};

type QuickAction = {
  title: string;
  description: string;
  helper: string;
  icon: string;
  tone: "dark" | "teal" | "white" | "amber";
  warningTitle: string;
  warningMessage: string;
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

function getCurrentPeriodMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: number | null | undefined, currency = "TL") {
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const [summaryData, movementData, carryForwardData, expenseSummaryData] =
          await Promise.all([
            fetchFinanceSummary(),
            fetchRecentFinanceMovements(),
            fetchOpenCarryForwards(),
            fetchPeriodExpenseSummary(currentPeriodMonth),
          ]);

        if (!isMounted) {
          return;
        }

        setSummary(summaryData);
        setMovements(movementData.items);
        setCarryForwards(carryForwardData);
        setPeriodExpenseSummary(expenseSummaryData);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Finans verileri alınamadı.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
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
    if (action.title === "Gider Faturası Gir") {
      setShowExpenseModal(true);
      return;
    }

    setSelectedAction(action);
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
          <div className="mt-5 rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-red-900">
            <p className="font-black">Finans verileri alınamadı.</p>
            <p className="mt-2 text-sm leading-6">{loadError}</p>
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

      {showExpenseModal ? (
        <ExpenseModal
          onClose={() => setShowExpenseModal(false)}
          onSaved={() => {
            setShowExpenseModal(false);
            window.location.reload();
          }}
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
          Bu ilk dashboard sürümünde işlem butonları güvenli uyarı akışını gösterir.
          Bir sonraki adımda ilgili işlem formlarını bu uyarı yapısının arkasına bağlayacağız.
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

function formatPeriodMonth(periodMonth: string) {
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

function ExpenseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
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
      onSaved();
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
