import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  createExpense,
  fetchExpenseEventOptions,
  fetchExpensePartnerOptions,
} from "../api/expensesApi";
import type {
  ExpenseCurrency,
  ExpenseEventOption,
  ExpensePartnerOption,
  ExpenseTabKey,
} from "../types/expenseTypes";

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

type ExpenseEntryFormProps = {
  activeTab: ExpenseTabKey;
  eventOptions?: ExpenseEventOption[];
  partnerOptions?: ExpensePartnerOption[];
  onSaved: () => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  showCancelButton?: boolean;
  className?: string;
};

const currencyOptions: ExpenseCurrency[] = ["TRY", "USD", "EUR", "GBP"];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getYearEndMonth(dateText: string) {
  const year = dateText.slice(0, 4) || new Date().getFullYear().toString();
  return `${year}-12`;
}

function getPeriodMonthFromDate(value: string) {
  if (!value || value.length < 7) {
    return new Date().toISOString().slice(0, 7);
  }

  return value.slice(0, 7);
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

function getEventLabel(event: ExpenseEventOption | undefined) {
  if (!event) {
    return "Etkinlik seçilmedi";
  }

  const eventCode = event.event_code ? `${event.event_code} · ` : "";
  return `${eventCode}${event.title} · ${formatDate(event.event_date)}`;
}

export function ExpenseEntryForm({
  activeTab,
  eventOptions,
  partnerOptions,
  onSaved,
  onCancel,
  submitLabel = "Gider kaydet",
  cancelLabel = "Vazgeç",
  showCancelButton = false,
  className = "",
}: ExpenseEntryFormProps) {
  const [form, setForm] = useState<ExpenseFormState>(() => createInitialForm());
  const [loadedEventOptions, setLoadedEventOptions] = useState<ExpenseEventOption[]>([]);
  const [loadedPartnerOptions, setLoadedPartnerOptions] = useState<ExpensePartnerOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveEventOptions = eventOptions ?? loadedEventOptions;
  const effectivePartnerOptions = partnerOptions ?? loadedPartnerOptions;

  const amount = parseNumberInput(form.amount || "0");
  const exchangeRate = parseNumberInput(form.exchangeRate || "1");
  const baseAmount = Number.isFinite(amount) && Number.isFinite(exchangeRate) ? amount * exchangeRate : 0;
  const startMonth = getPeriodMonthFromDate(form.expenseDate);
  const endMonth = activeTab === "distributed" ? form.allocationEndMonth || getYearEndMonth(form.expenseDate) : startMonth;
  const monthCount = activeTab === "distributed" ? getMonthCount(startMonth, endMonth) : 1;
  const monthlyShare = monthCount > 0 ? baseAmount / monthCount : 0;

  const operationSummary = useMemo(() => {
    if (activeTab === "event") {
      return "Bu kayıt seçilen etkinliğin giderine yazılır ve etkinlik kârlılığını etkiler.";
    }

    if (activeTab === "distributed") {
      return `Bu sezonluk gider ${formatPeriodMonth(startMonth)} - ${formatPeriodMonth(endMonth)} arasında ${Math.max(monthCount, 0)} aya bölünecek. Yaklaşık aylık pay: ${formatMoney(monthlyShare, form.currency)}.`;
    }

    return `Bu gider ${formatPeriodMonth(startMonth)} dönemine genel gider olarak yazılacak. Toplam etki: ${formatMoney(baseAmount, form.currency)}.`;
  }, [activeTab, baseAmount, endMonth, form.currency, monthCount, monthlyShare, startMonth]);

  useEffect(() => {
    let isMounted = true;

    if (eventOptions && partnerOptions) {
      return;
    }

    async function loadOptions() {
      try {
        setIsLoadingOptions(true);
        setError(null);
        const [events, partners] = await Promise.all([
          eventOptions ? Promise.resolve(eventOptions) : fetchExpenseEventOptions(),
          partnerOptions ? Promise.resolve(partnerOptions) : fetchExpensePartnerOptions(),
        ]);

        if (!isMounted) {
          return;
        }

        if (!eventOptions) {
          setLoadedEventOptions(events);
        }

        if (!partnerOptions) {
          setLoadedPartnerOptions(partners);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Gider form seçenekleri yüklenemedi.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [eventOptions, partnerOptions]);

  useEffect(() => {
    setIsConfirming(false);
    setError(null);
    setMessage(null);
  }, [activeTab]);

  function updateForm(field: keyof ExpenseFormState, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
      ...(field === "expenseDate" && activeTab === "distributed"
        ? { allocationEndMonth: getYearEndMonth(value) }
        : {}),
    }));
    setIsConfirming(false);
    setError(null);
    setMessage(null);
  }

  function resetForm() {
    setForm(createInitialForm());
    setIsConfirming(false);
    setError(null);
  }

  function validateForm() {
    if (!form.title.trim()) {
      return "Gider başlığı zorunludur.";
    }

    if (!form.expenseDate) {
      return "Gider tarihi zorunludur.";
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return "Gider tutarı sıfırdan büyük olmalıdır.";
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return "Kur değeri sıfırdan büyük olmalıdır.";
    }

    if (activeTab === "event" && !form.eventId) {
      return "Etkinliğe bağlı gider için etkinlik seçmelisin.";
    }

    if (activeTab === "distributed" && !form.allocationEndMonth) {
      return "Dağıtılmış gider için dağıtım bitiş ayı zorunludur.";
    }

    if (activeTab === "distributed" && monthCount <= 0) {
      return "Dağıtım bitiş ayı başlangıç ayından önce olamaz.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }

    try {
      setIsSaving(true);

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
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gider kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {activeTab === "event" ? (
        <label className="block">
          <span className="text-sm font-black text-slate-700">Etkinlik</span>
          <select
            value={form.eventId}
            onChange={(event) => updateForm("eventId", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
            disabled={isLoadingOptions}
          >
            <option value="">Etkinlik seç</option>
            {effectiveEventOptions.map((eventItem) => (
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
          onChange={(event) => updateForm("title", event.target.value)}
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
            onChange={(event) => updateForm("expenseDate", event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>

        {activeTab === "distributed" ? (
          <label className="block">
            <span className="text-sm font-black text-slate-700">Dağıtım bitiş ayı</span>
            <input
              type="month"
              value={form.allocationEndMonth}
              onChange={(event) => updateForm("allocationEndMonth", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-sm font-black text-slate-700">Belge no</span>
            <input
              value={form.documentNo}
              onChange={(event) => updateForm("documentNo", event.target.value)}
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
            onChange={(event) => updateForm("amount", event.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Para birimi</span>
          <select
            value={form.currency}
            onChange={(event) => updateForm("currency", event.target.value)}
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
            onChange={(event) => updateForm("exchangeRate", event.target.value)}
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
          onChange={(event) => updateForm("paidByPartnerId", event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
          disabled={isLoadingOptions}
        >
          <option value="">Şirket / kullanıcı ödedi</option>
          {effectivePartnerOptions.map((partner) => (
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
            onChange={(event) => updateForm("documentNo", event.target.value)}
            placeholder="Fiş / fatura no"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-black text-slate-700">Açıklama</span>
          <textarea
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            rows={3}
            placeholder="Giderin kısa açıklaması"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>

        <label className="block">
          <span className="text-sm font-black text-slate-700">Not</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateForm("notes", event.target.value)}
            rows={3}
            placeholder="İç not / muhasebe notu"
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-400"
          />
        </label>
      </div>

      <div className="rounded-[1.25rem] bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-700">İşlem Özeti</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{operationSummary}</p>
      </div>

      {isConfirming ? (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="font-black">
            {activeTab === "distributed"
              ? "Dağıtılmış gider aylara bölünecek"
              : activeTab === "event"
                ? "Etkinliğe bağlı gider kaydedilecek"
                : "Genel aylık gider kaydedilecek"}
          </p>
          <p className="mt-2 text-sm leading-6">
            Devam edersen gider kaydı backend'e gönderilecek. Onaylıyor musun?
          </p>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={resetForm}
          className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-200"
          disabled={isSaving}
        >
          Formu temizle
        </button>
        {showCancelButton ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
            disabled={isSaving}
          >
            {cancelLabel}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSaving || isLoadingOptions}
          className="rounded-full bg-teal-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-400 disabled:opacity-60"
        >
          {isSaving
            ? "Kaydediliyor..."
            : isConfirming
              ? "Onayla ve kaydet"
              : submitLabel}
        </button>
      </div>
    </form>
  );
}
