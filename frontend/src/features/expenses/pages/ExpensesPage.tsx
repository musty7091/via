import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  cancelExpense,
  createExpense,
  fetchExpenseDetail,
  fetchExpenseEventOptions,
  fetchExpensePartnerOptions,
  fetchExpenses,
  fetchPeriodAllocations,
  fetchPeriodExpenseSummary,
} from "../api/expensesApi";
import type {
  DistributedExpense,
  EventExpense,
  ExpenseAllocation,
  ExpenseCurrency,
  ExpenseEventOption,
  ExpensePartnerOption,
  ExpenseRead,
  ExpenseTabKey,
  ExpenseWithAllocations,
  GeneralMonthlyExpense,
  PeriodExpenseSummary,
} from "../types/expenseTypes";

type ExpensesPageProps = {
  onBackToDashboard: () => void;
};

type ExpenseFormState = {
  title: string;
  description: string;
  expenseDate: string;
  amount: string;
  currency: ExpenseCurrency;
  exchangeRate: string;
  documentNo: string;
  notes: string;
  eventId: string;
  paidByPartnerId: string;
  allocationEndMonth: string;
};

const tabs: Array<{ key: ExpenseTabKey; label: string; description: string }> = [
  {
    key: "event",
    label: "Etkinliğe Bağlı Giderler",
    description: "Belirli bir etkinliğe yazılan ulaşım, dekor, ekipman ve benzeri giderler.",
  },
  {
    key: "general",
    label: "Genel Aylık Giderler",
    description: "O ayın genel şirket giderleri. Etkinliğe bağlı değildir.",
  },
  {
    key: "distributed",
    label: "Dağıtılmış Giderler",
    description: "Sezonluk veya yıllık giderleri aylara bölerek takip eder.",
  },
];

const currencyOptions: ExpenseCurrency[] = ["TRY", "USD", "EUR", "GBP"];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getYearEndMonth(dateText: string) {
  const year = dateText.slice(0, 4) || new Date().getFullYear().toString();
  return `${year}-12`;
}

function createInitialForm(): ExpenseFormState {
  const today = getToday();

  return {
    title: "",
    description: "",
    expenseDate: today,
    amount: "",
    currency: "TRY",
    exchangeRate: "1",
    documentNo: "",
    notes: "",
    eventId: "",
    paidByPartnerId: "",
    allocationEndMonth: getYearEndMonth(today),
  };
}

function parseNumberInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatMoney(value: number | null | undefined, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getExpensePeriod(expense: ExpenseRead) {
  return expense.expense_date.slice(0, 7);
}

function getExpenseStatusLabel(expense: ExpenseRead) {
  if (expense.is_cancelled || expense.status === "cancelled") {
    return "İptal";
  }

  if (expense.status === "approved") {
    return "Onaylı";
  }

  return expense.status;
}

function getEventLabel(event: ExpenseEventOption | undefined) {
  if (!event) {
    return "Etkinlik seçilmedi";
  }

  const eventCode = event.event_code ? `${event.event_code} · ` : "";
  return `${eventCode}${event.title} · ${formatDate(event.event_date)}`;
}

function isEventExpense(expense: ExpenseRead): expense is EventExpense {
  return !expense.is_allocated && expense.event_id !== null;
}

function isGeneralExpense(expense: ExpenseRead): expense is GeneralMonthlyExpense {
  return !expense.is_allocated && expense.event_id === null;
}

function isDistributedExpense(expense: ExpenseRead): expense is DistributedExpense {
  return expense.is_allocated === true;
}

export function ExpensesPage({ onBackToDashboard }: ExpensesPageProps) {
  const [activeTab, setActiveTab] = useState<ExpenseTabKey>("event");
  const [periodMonth, setPeriodMonth] = useState(getCurrentMonth());
  const [form, setForm] = useState<ExpenseFormState>(() => createInitialForm());
  const [eventOptions, setEventOptions] = useState<ExpenseEventOption[]>([]);
  const [partnerOptions, setPartnerOptions] = useState<ExpensePartnerOption[]>([]);
  const [periodExpenses, setPeriodExpenses] = useState<ExpenseRead[]>([]);
  const [distributedExpenses, setDistributedExpenses] = useState<ExpenseRead[]>([]);
  const [periodAllocations, setPeriodAllocations] = useState<ExpenseAllocation[]>([]);
  const [periodSummary, setPeriodSummary] = useState<PeriodExpenseSummary | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ExpenseWithAllocations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eventMap = useMemo(() => {
    return new Map(eventOptions.map((event) => [event.id, event]));
  }, [eventOptions]);

  const partnerMap = useMemo(() => {
    return new Map(partnerOptions.map((partner) => [partner.id, partner]));
  }, [partnerOptions]);

  const eventExpenses = useMemo(
    () => periodExpenses.filter(isEventExpense),
    [periodExpenses]
  );

  const generalExpenses = useMemo(
    () => periodExpenses.filter(isGeneralExpense),
    [periodExpenses]
  );

  const activeDistributedExpenses = useMemo(
    () => distributedExpenses.filter(isDistributedExpense),
    [distributedExpenses]
  );

  const activeTabExpenses =
    activeTab === "event"
      ? eventExpenses
      : activeTab === "general"
        ? generalExpenses
        : activeDistributedExpenses;

  const activeTabTotal = activeTabExpenses.reduce(
    (total, expense) => total + Number(expense.base_amount ?? 0),
    0
  );

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [
        periodExpenseRows,
        distributedExpenseRows,
        summary,
        allocations,
        events,
        partners,
      ] = await Promise.all([
        fetchExpenses({ periodMonth, expenseScope: "period" }),
        fetchExpenses({ expenseScope: "season" }),
        fetchPeriodExpenseSummary(periodMonth),
        fetchPeriodAllocations(periodMonth),
        fetchExpenseEventOptions(),
        fetchExpensePartnerOptions(),
      ]);

      setPeriodExpenses(periodExpenseRows);
      setDistributedExpenses(distributedExpenseRows);
      setPeriodSummary(summary);
      setPeriodAllocations(allocations);
      setEventOptions(events);
      setPartnerOptions(partners);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gider verileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [periodMonth]);

  function updateForm(field: keyof ExpenseFormState, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "expenseDate" && activeTab === "distributed"
        ? { allocationEndMonth: getYearEndMonth(value) }
        : {}),
    }));
  }

  function resetForm() {
    setForm(createInitialForm());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const amount = parseNumberInput(form.amount);
      const exchangeRate = parseNumberInput(form.exchangeRate);

      if (!form.title.trim()) {
        throw new Error("Gider başlığı zorunludur.");
      }

      if (!form.expenseDate) {
        throw new Error("Gider tarihi zorunludur.");
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Gider tutarı sıfırdan büyük olmalıdır.");
      }

      if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
        throw new Error("Kur değeri sıfırdan büyük olmalıdır.");
      }

      if (activeTab === "event" && !form.eventId) {
        throw new Error("Etkinliğe bağlı gider için etkinlik seçmelisin.");
      }

      if (activeTab === "distributed" && !form.allocationEndMonth) {
        throw new Error("Dağıtılmış gider için dağıtım bitiş ayı zorunludur.");
      }

      await createExpense({
        title: form.title.trim(),
        description: form.description.trim() || null,
        expense_date: form.expenseDate,
        amount,
        currency: form.currency,
        exchange_rate: exchangeRate,
        expense_scope: activeTab === "distributed" ? "season" : "period",
        expense_type:
          activeTab === "event"
            ? "event"
            : activeTab === "distributed"
              ? "seasonal"
              : "general",
        event_id: activeTab === "event" ? Number(form.eventId) : null,
        paid_by_partner_id: form.paidByPartnerId ? Number(form.paidByPartnerId) : null,
        allocation_end_month: activeTab === "distributed" ? form.allocationEndMonth : null,
        document_no: form.documentNo.trim() || null,
        notes: form.notes.trim() || null,
      });

      setMessage("Gider kaydı başarıyla oluşturuldu.");
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gider kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function openExpenseDetail(expenseId: number) {
    setSelectedDetail(null);
    setMessage(null);
    setError(null);

    try {
      const detail = await fetchExpenseDetail(expenseId);
      setSelectedDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gider detayı alınamadı.");
    }
  }

  async function handleCancelExpense(expense: ExpenseRead) {
    const reason = window.prompt(
      `"${expense.title}" giderini iptal etmek için iptal nedenini yaz.`
    );

    if (reason === null) {
      return;
    }

    if (!reason.trim()) {
      setError("İptal nedeni boş olamaz.");
      return;
    }

    setMessage(null);
    setError(null);

    try {
      await cancelExpense(expense.id, { cancellation_reason: reason.trim() });
      setMessage("Gider kaydı iptal edildi. Backend aktif listede iptal edilenleri göstermediği için kayıt listeden kalkar.");
      if (selectedDetail?.expense.id === expense.id) {
        setSelectedDetail(null);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gider iptal edilemedi.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <button
              onClick={onBackToDashboard}
              className="text-sm font-bold text-slate-500 transition hover:text-slate-950"
            >
              ← Back Office
            </button>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">Gider Yönetimi</h1>
            <p className="mt-1 text-sm text-slate-500">
              Etkinlik giderleri, genel aylık giderler ve sezonluk dağıtılmış giderler.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Yükleniyor..." : "Yenile"}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-lg shadow-slate-300 lg:col-span-2">
            <p className="text-sm font-bold text-teal-200">Seçili dönem</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Ay</span>
                <input
                  type="month"
                  value={periodMonth}
                  onChange={(event) => setPeriodMonth(event.target.value)}
                  className="mt-2 rounded-2xl border border-white/10 bg-white px-4 py-3 font-black text-slate-950 outline-none"
                />
              </label>
              <div>
                <p className="text-3xl font-black">
                  {formatMoney(periodSummary?.total_period_expense_base_amount ?? 0)}
                </p>
                <p className="mt-1 text-sm text-slate-300">Bu dönemin toplam genel + dağıtılmış gider etkisi</p>
              </div>
            </div>
          </div>

          <SummaryCard
            title="Genel aylık gider"
            value={formatMoney(periodSummary?.direct_general_expense_base_amount ?? 0)}
            description={`${periodSummary?.direct_expense_count ?? 0} direkt kayıt`}
          />
          <SummaryCard
            title="Dağıtılmış gider payı"
            value={formatMoney(periodSummary?.allocated_expense_base_amount ?? 0)}
            description={`${periodSummary?.allocation_count ?? 0} aylık dağıtım satırı`}
          />
        </div>

        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
          <section className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedDetail(null);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${
                    activeTab === tab.key
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {tabs.find((tab) => tab.key === activeTab)?.description}
            </p>

            <ExpenseForm
              activeTab={activeTab}
              form={form}
              eventOptions={eventOptions}
              partnerOptions={partnerOptions}
              saving={saving}
              onSubmit={handleSubmit}
              onChange={updateForm}
              onReset={resetForm}
            />
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">Kayıt listesi</p>
                <h2 className="mt-1 text-2xl font-black">
                  {tabs.find((tab) => tab.key === activeTab)?.label}
                </h2>
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                <p className="text-xs font-bold text-slate-500">Görünen toplam</p>
                <p className="font-black">{formatMoney(activeTabTotal)}</p>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
                Gider kayıtları yükleniyor...
              </div>
            ) : activeTabExpenses.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="font-black text-slate-700">Bu bölümde kayıt yok.</p>
                <p className="mt-2 text-sm text-slate-500">Sol taraftaki formdan ilk gider kaydını oluşturabilirsin.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {activeTabExpenses.map((expense) => (
                  <ExpenseListItem
                    key={expense.id}
                    expense={expense}
                    eventLabel={expense.event_id ? getEventLabel(eventMap.get(expense.event_id)) : null}
                    partnerName={
                      expense.paid_by_partner_id
                        ? partnerMap.get(expense.paid_by_partner_id)?.full_name ?? null
                        : null
                    }
                    onOpenDetail={() => openExpenseDetail(expense.id)}
                    onCancel={() => handleCancelExpense(expense)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {activeTab === "distributed" ? (
          <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">{periodMonth} dağıtım satırları</p>
                <h2 className="mt-1 text-2xl font-black">Bu aya düşen sezonluk gider payları</h2>
              </div>
              <p className="rounded-full bg-teal-50 px-4 py-2 text-sm font-black text-teal-800">
                {formatMoney(
                  periodAllocations.reduce(
                    (total, allocation) => total + Number(allocation.allocated_base_amount ?? 0),
                    0
                  )
                )}
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Gider</th>
                    <th className="px-4 py-3">Dönem</th>
                    <th className="px-4 py-3 text-right">Aylık pay</th>
                    <th className="px-4 py-3">Not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {periodAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        Bu ay için dağıtılmış gider payı yok.
                      </td>
                    </tr>
                  ) : (
                    periodAllocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="px-4 py-3 font-bold">{allocation.expense_title ?? `#${allocation.expense_id}`}</td>
                        <td className="px-4 py-3">{allocation.period_month}</td>
                        <td className="px-4 py-3 text-right font-black">{formatMoney(allocation.allocated_base_amount)}</td>
                        <td className="px-4 py-3 text-slate-500">{allocation.notes ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {selectedDetail ? (
          <ExpenseDetailPanel
            detail={selectedDetail}
            eventLabel={
              selectedDetail.expense.event_id
                ? getEventLabel(eventMap.get(selectedDetail.expense.event_id))
                : null
            }
            partnerName={
              selectedDetail.expense.paid_by_partner_id
                ? partnerMap.get(selectedDetail.expense.paid_by_partner_id)?.full_name ?? null
                : null
            }
            onClose={() => setSelectedDetail(null)}
          />
        ) : null}
      </section>
    </main>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
};

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <div className="rounded-[1.5rem] bg-white p-5 shadow-lg shadow-slate-200">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

type ExpenseFormProps = {
  activeTab: ExpenseTabKey;
  form: ExpenseFormState;
  eventOptions: ExpenseEventOption[];
  partnerOptions: ExpensePartnerOption[];
  saving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (field: keyof ExpenseFormState, value: string) => void;
  onReset: () => void;
};

function ExpenseForm({
  activeTab,
  form,
  eventOptions,
  partnerOptions,
  saving,
  onSubmit,
  onChange,
  onReset,
}: ExpenseFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      {activeTab === "event" ? (
        <label className="block">
          <span className="text-sm font-black text-slate-700">Etkinlik</span>
          <select
            value={form.eventId}
            onChange={(event) => onChange("eventId", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
          >
            <option value="">Etkinlik seç</option>
            {eventOptions.map((eventItem) => (
              <option key={eventItem.id} value={eventItem.id}>
                {getEventLabel(eventItem)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-black text-slate-700">Gider başlığı</span>
        <input
          value={form.title}
          onChange={(event) => onChange("title", event.target.value)}
          placeholder="Örn: Ses sistemi ekstra ekipman"
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-slate-700">Gider tarihi</span>
          <input
            type="date"
            value={form.expenseDate}
            onChange={(event) => onChange("expenseDate", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>

        {activeTab === "distributed" ? (
          <label className="block">
            <span className="text-sm font-black text-slate-700">Dağıtım bitiş ayı</span>
            <input
              type="month"
              value={form.allocationEndMonth}
              onChange={(event) => onChange("allocationEndMonth", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-sm font-black text-slate-700">Belge no</span>
            <input
              value={form.documentNo}
              onChange={(event) => onChange("documentNo", event.target.value)}
              placeholder="Fiş / fatura no"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
            />
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="text-sm font-black text-slate-700">Tutar</span>
          <input
            value={form.amount}
            onChange={(event) => onChange("amount", event.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Para birimi</span>
          <select
            value={form.currency}
            onChange={(event) => onChange("currency", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-teal-400"
          >
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Kur</span>
          <input
            value={form.exchangeRate}
            onChange={(event) => onChange("exchangeRate", event.target.value)}
            placeholder="1"
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-black text-slate-700">Ödeyen ortak / üzerinde para kalan ortak</span>
        <select
          value={form.paidByPartnerId}
          onChange={(event) => onChange("paidByPartnerId", event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
        >
          <option value="">Şirket / kullanıcı ödedi</option>
          {partnerOptions.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.full_name}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          Ortak seçersen gider ödemesinin hangi ortak üzerinden geçtiğini ayrıca takip edebiliriz.
        </span>
      </label>

      {activeTab === "distributed" ? (
        <label className="block">
          <span className="text-sm font-black text-slate-700">Belge no</span>
          <input
            value={form.documentNo}
            onChange={(event) => onChange("documentNo", event.target.value)}
            placeholder="Fiş / fatura no"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-black text-slate-700">Açıklama</span>
        <textarea
          value={form.description}
          onChange={(event) => onChange("description", event.target.value)}
          rows={3}
          placeholder="Giderin kısa açıklaması"
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
        />
      </label>

      <label className="block">
        <span className="text-sm font-black text-slate-700">Not</span>
        <textarea
          value={form.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          rows={2}
          placeholder="İç not / muhasebe notu"
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
        />
      </label>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-teal-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-400 disabled:opacity-60"
        >
          {saving ? "Kaydediliyor..." : "Gider kaydet"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200"
        >
          Formu temizle
        </button>
      </div>
    </form>
  );
}

type ExpenseListItemProps = {
  expense: ExpenseRead;
  eventLabel: string | null;
  partnerName: string | null;
  onOpenDetail: () => void;
  onCancel: () => void;
};

function ExpenseListItem({ expense, eventLabel, partnerName, onOpenDetail, onCancel }: ExpenseListItemProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-slate-950">{expense.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(expense.expense_date)} · {expense.document_no ? `Belge: ${expense.document_no}` : "Belge yok"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black">{formatMoney(expense.base_amount)}</p>
          <p className="text-xs font-bold text-slate-500">
            Orijinal: {formatMoney(expense.amount, expense.currency)} · Kur {expense.exchange_rate}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-white px-3 py-2 text-slate-600">{getExpenseStatusLabel(expense)}</span>
        <span className="rounded-full bg-white px-3 py-2 text-slate-600">Dönem: {getExpensePeriod(expense)}</span>
        {expense.is_allocated ? (
          <span className="rounded-full bg-teal-50 px-3 py-2 text-teal-800">
            {expense.allocation_start_month} - {expense.allocation_end_month}
          </span>
        ) : null}
        {eventLabel ? (
          <span className="rounded-full bg-indigo-50 px-3 py-2 text-indigo-800">{eventLabel}</span>
        ) : null}
        {partnerName ? (
          <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-800">Ödeyen ortak: {partnerName}</span>
        ) : null}
      </div>

      {expense.description ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">{expense.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
        >
          Detay
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-100"
        >
          İptal et
        </button>
      </div>
    </div>
  );
}

type ExpenseDetailPanelProps = {
  detail: ExpenseWithAllocations;
  eventLabel: string | null;
  partnerName: string | null;
  onClose: () => void;
};

function ExpenseDetailPanel({ detail, eventLabel, partnerName, onClose }: ExpenseDetailPanelProps) {
  const expense = detail.expense;

  return (
    <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">Gider detayı</p>
          <h2 className="mt-1 text-2xl font-black">{expense.title}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {formatDate(expense.expense_date)} · {expense.document_no ?? "Belge yok"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
        >
          Kapat
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard title="Ana tutar" value={formatMoney(expense.amount, expense.currency)} description={`Kur: ${expense.exchange_rate}`} />
        <SummaryCard title="TL karşılığı" value={formatMoney(expense.base_amount)} description="Backend base_amount" />
        <SummaryCard title="Durum" value={getExpenseStatusLabel(expense)} description={expense.is_allocated ? "Dağıtılmış" : "Direkt gider"} />
        <SummaryCard title="Bağlantı" value={eventLabel ? "Etkinlik" : "Genel"} description={eventLabel ?? partnerName ?? "Şirket gideri"} />
      </div>

      {expense.description || expense.cancellation_reason ? (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {expense.description ? <p>{expense.description}</p> : null}
          {expense.cancellation_reason ? (
            <p className="mt-2 font-bold text-rose-700">İptal nedeni: {expense.cancellation_reason}</p>
          ) : null}
        </div>
      ) : null}

      {detail.allocations.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Dönem</th>
                <th className="px-4 py-3 text-right">Dağıtılan tutar</th>
                <th className="px-4 py-3">Not</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.allocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td className="px-4 py-3 font-bold">{allocation.period_month}</td>
                  <td className="px-4 py-3 text-right font-black">{formatMoney(allocation.allocated_base_amount)}</td>
                  <td className="px-4 py-3 text-slate-500">{allocation.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
