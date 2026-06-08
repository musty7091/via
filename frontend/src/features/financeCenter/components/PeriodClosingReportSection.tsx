import { useEffect, useMemo, useState } from "react";

import { closePeriod, fetchPeriodClosingPreview } from "../api/financeCenterApi";
import type {
  PeriodCloseResponse,
  PeriodClosingIssue,
  PeriodClosingPreviewItem,
  PeriodClosingPreviewResponse,
} from "../types/financeCenterTypes";

type PeriodClosingReportSectionProps = {
  focusKey?: number;
  currentPeriodMonth: string;
  onChanged: () => Promise<void> | void;
};

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
    open_event: "Açık Etkinlik",
    customer_receivable: "Müşteri Alacağı",
    supplier_payable: "Sanatçı / Hizmet Borcu",
    partner_cash_on_hand: "Ortağın Üzerindeki Para",
    company_payable_to_partner: "Şirketin Ortağa Borcu",
  };

  return labels[carryType] ?? carryType;
}

function getCarryTypeTone(carryType: string) {
  if (carryType === "customer_receivable") {
    return "border-teal-100 bg-teal-50 text-teal-950";
  }

  if (carryType === "supplier_payable") {
    return "border-amber-100 bg-amber-50 text-amber-950";
  }

  if (carryType === "partner_cash_on_hand") {
    return "border-orange-100 bg-orange-50 text-orange-950";
  }

  if (carryType === "open_event") {
    return "border-slate-200 bg-slate-50 text-slate-950";
  }

  return "border-rose-100 bg-rose-50 text-rose-950";
}

function isValidPeriodMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export function PeriodClosingReportSection({
  focusKey = 0,
  currentPeriodMonth,
  onChanged,
}: PeriodClosingReportSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [periodMonth, setPeriodMonth] = useState(currentPeriodMonth);
  const [preview, setPreview] = useState<PeriodClosingPreviewResponse | null>(null);
  const [closeResult, setCloseResult] = useState<PeriodCloseResponse | null>(null);
  const [closingNote, setClosingNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (focusKey <= 0) {
      return;
    }

    setIsOpen(true);

    window.setTimeout(() => {
      document.getElementById("finance-period-closing-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, [focusKey]);

  const summary = preview?.summary ?? null;

  const carryForwardTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    preview?.carry_forward_items.forEach((item) => {
      totals[item.carry_type] =
        (totals[item.carry_type] ?? 0) + Number(item.remaining_base_amount ?? 0);
    });

    return totals;
  }, [preview]);

  const groupedCarryForwardItems = useMemo(() => {
    const grouped: Record<string, PeriodClosingPreviewItem[]> = {};

    preview?.carry_forward_items.forEach((item) => {
      if (!grouped[item.carry_type]) {
        grouped[item.carry_type] = [];
      }

      grouped[item.carry_type].push(item);
    });

    return grouped;
  }, [preview]);

  const canClose =
    Boolean(summary?.can_close_period) &&
    !summary?.source_period_is_locked &&
    confirmText.trim().toLocaleUpperCase("tr-TR") === "KAPAT";

  async function handleLoadPreview() {
    if (!isValidPeriodMonth(periodMonth)) {
      setErrorMessage("Dönem formatı geçersiz. Örnek: 2026-06");
      return;
    }

    setIsPreviewLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCloseResult(null);

    try {
      const data = await fetchPeriodClosingPreview(periodMonth);
      setPreview(data);
    } catch (error) {
      setPreview(null);
      setErrorMessage(error instanceof Error ? error.message : "Dönem kapanış raporu alınamadı.");
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleClosePeriod() {
    if (!preview) {
      setErrorMessage("Önce dönem kapanış raporunu hazırla.");
      return;
    }

    if (summary?.source_period_is_locked) {
      setErrorMessage("Bu dönem zaten kapatılmış ve kilitlenmiş.");
      return;
    }

    if (!summary?.can_close_period) {
      setErrorMessage("Bu dönem kapatılamaz. Önce rapordaki engelleri kontrol et.");
      return;
    }

    if (confirmText.trim().toLocaleUpperCase("tr-TR") !== "KAPAT") {
      setErrorMessage("Dönemi kapatmak için onay alanına KAPAT yazmalısın.");
      return;
    }

    setIsClosing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await closePeriod(periodMonth, {
        closing_note: closingNote.trim() || null,
      });

      setCloseResult(result);
      setSuccessMessage(result.message || "Dönem kapatıldı ve açık kalemler devredildi.");
      setClosingNote("");
      setConfirmText("");

      const refreshedPreview = await fetchPeriodClosingPreview(periodMonth);
      setPreview(refreshedPreview);

      await onChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Dönem kapatılamadı.");
    } finally {
      setIsClosing(false);
    }
  }

  return (
    <section id="finance-period-closing-section" className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Dönem Kapanış Raporu
          </p>
          <h3 className="mt-1 text-2xl font-black">Ay sonu kapanış kontrolü</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
            Dönemi kapatmadan önce gelir, maliyet, gider, açık etkinlik ve devredecek kalemleri kontrol et.
            Bu ekran önce rapor gösterir; kapatma işlemi en altta ayrıca onay ister.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextIsOpen = !isOpen;
            setIsOpen(nextIsOpen);

            if (nextIsOpen) {
              window.setTimeout(() => {
                document.getElementById("finance-period-closing-section")?.scrollIntoView({
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

      {errorMessage ? (
        <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-900">
          {errorMessage}
        </div>
      ) : null}

      {isOpen ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                1. Dönem seç
              </span>
              <input
                type="month"
                value={periodMonth}
                onChange={(event) => {
                  setPeriodMonth(event.target.value);
                  setPreview(null);
                  setCloseResult(null);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleLoadPreview}
                disabled={isPreviewLoading}
                className="h-12 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {isPreviewLoading ? "Hazırlanıyor..." : "Raporu Hazırla"}
              </button>
            </div>
          </div>

          {isPreviewLoading ? (
            <div className="rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold text-slate-500">
              Dönem kapanış raporu hesaplanıyor...
            </div>
          ) : null}

          {summary ? (
            <>
              <div
                className={`rounded-[1.5rem] border p-5 ${
                  summary.source_period_is_locked
                    ? "border-slate-200 bg-slate-50 text-slate-950"
                    : summary.can_close_period
                      ? "border-teal-100 bg-teal-50 text-teal-950"
                      : "border-rose-100 bg-rose-50 text-rose-950"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-4xl">
                    <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
                      2. Sistem yorumu
                    </p>
                    <h4 className="mt-2 text-2xl font-black">
                      {summary.source_period_is_locked
                        ? "Bu dönem kapalı"
                        : summary.can_close_period
                          ? "Dönem kapanışa hazır"
                          : "Dönem kapatılamaz"}
                    </h4>
                    <p className="mt-2 text-sm font-bold leading-6 opacity-80">
                      {summary.source_period_is_locked
                        ? `${formatPeriodMonth(summary.period_month)} dönemi daha önce kapatılmış ve kilitlenmiş.`
                        : summary.can_close_period
                          ? `${formatPeriodMonth(summary.period_month)} kapatılırsa açık kalemler ${formatPeriodMonth(summary.target_period_month)} dönemine devredilir.`
                          : "Kapanışı engelleyen bir durum var. Aşağıdaki uyarıları kontrol et."}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/75 px-5 py-4 text-right shadow-sm">
                    <p className="text-3xl font-black">{summary.carry_forward_count}</p>
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
                      Devreden Kalem
                    </p>
                    <p className="mt-1 text-sm font-black">{summary.open_event_count} açık etkinlik</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ReportMetric title="Etkinlik Sayısı" value={String(summary.event_count)} subtitle={`${summary.open_event_count} açık etkinlik`} />
                <ReportMetric title="Dönem Geliri" value={formatMoney(summary.total_revenue_base_amount)} />
                <ReportMetric title="Etkinlik Maliyeti" value={formatMoney(summary.total_event_cost_base_amount)} />
                <ReportMetric title="Etkinlik Gideri" value={formatMoney(summary.total_event_expense_base_amount)} />
                <ReportMetric title="Genel Gider" value={formatMoney(summary.total_general_expense_base_amount)} subtitle={`Sezon payı: ${formatMoney(summary.total_allocated_expense_base_amount)}`} />
                <ReportMetric title="Net Kâr/Zarar" value={formatMoney(summary.net_profit_base_amount)} strong />
                <ReportMetric title="Müşteri Alacağı Devri" value={formatMoney(summary.customer_receivable_base_amount)} tone={summary.customer_receivable_base_amount > 0 ? "warning" : "default"} />
                <ReportMetric title="Sanatçı/Hizmet Borcu Devri" value={formatMoney(summary.supplier_payable_base_amount)} tone={summary.supplier_payable_base_amount > 0 ? "warning" : "default"} />
                <ReportMetric title="Ortak Üzerindeki Para" value={formatMoney(summary.partner_cash_on_hand_base_amount)} tone={summary.partner_cash_on_hand_base_amount > 0 ? "warning" : "default"} />
                <ReportMetric title="Şirketin Ortağa Borcu" value={formatMoney(summary.company_payable_to_partner_base_amount)} tone={summary.company_payable_to_partner_base_amount > 0 ? "warning" : "default"} />
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                      3. Devredecek kalemler
                    </p>
                    <h4 className="mt-1 text-xl font-black">
                      Bu dönem kapatılırsa sonraki döneme taşınacaklar
                    </h4>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600">
                    Hedef dönem: {formatPeriodMonth(summary.target_period_month)}
                  </span>
                </div>

                {(preview?.carry_forward_items ?? []).length === 0 ? (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-white p-5 text-sm font-bold text-slate-500">
                    Devredecek açık kalem görünmüyor.
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {Object.entries(groupedCarryForwardItems).map(([carryType, items]) => (
                      <div key={carryType} className={`rounded-[1.25rem] border p-4 ${getCarryTypeTone(carryType)}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{getCarryTypeLabel(carryType)}</p>
                            <p className="mt-1 text-sm font-bold opacity-75">{items.length} kalem</p>
                          </div>
                          <span className="rounded-full bg-white/80 px-3 py-2 text-xs font-black shadow-sm">
                            {formatMoney(carryForwardTotals[carryType] ?? 0)}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {items.map((item, index) => (
                            <div key={`${carryType}-${index}`} className="rounded-2xl bg-white/75 p-3 text-sm font-bold leading-6">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span>{item.event_title || "Etkinlik bağlantısı yok"}</span>
                                <span>{formatMoney(item.remaining_base_amount)}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 opacity-70">{item.carry_reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(preview?.issues ?? []).length > 0 ? (
                <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
                    Uyarılar
                  </p>
                  <div className="mt-3 space-y-2">
                    {(preview?.issues ?? []).map((issue) => (
                      <IssueRow key={issue.key} issue={issue} />
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                  4. Kontrollü kapanış
                </p>

                {summary.source_period_is_locked ? (
                  <div className="mt-4 rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-600">
                    Bu dönem zaten kapalı ve kilitli olduğu için tekrar kapanış yapılamaz.
                  </div>
                ) : (
                  <>
                    <h4 className="mt-1 text-xl font-black">Dönemi kapat ve kilitle</h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Bu işlem dönem kayıtlarını kilitler. Açık etkinlikler ve açık bakiyeler sonraki döneme devredilir.
                      Devam etmek için onay alanına <span className="font-black text-slate-950">KAPAT</span> yazmalısın.
                    </p>

                    <textarea
                      value={closingNote}
                      onChange={(event) => setClosingNote(event.target.value)}
                      className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
                      placeholder="Kapanış notu"
                    />

                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <input
                        value={confirmText}
                        onChange={(event) => setConfirmText(event.target.value)}
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none focus:border-rose-400"
                        placeholder="Dönemi kapatmak için KAPAT yaz"
                      />

                      <button
                        type="button"
                        onClick={handleClosePeriod}
                        disabled={isClosing || !canClose}
                        className="h-12 rounded-full bg-rose-700 px-5 text-sm font-black text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isClosing ? "Kapatılıyor..." : "Dönemi Kapat ve Kilitle"}
                      </button>
                    </div>

                    {!summary.can_close_period ? (
                      <p className="mt-3 text-sm font-bold text-rose-700">
                        Bu dönem şu an kapatılamaz. Önce rapordaki engeller giderilmeli.
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {closeResult ? (
                <div className="rounded-[1.5rem] border border-teal-100 bg-teal-50 p-5 text-teal-950">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-600">
                    Kapanış sonucu
                  </p>
                  <h4 className="mt-1 text-xl font-black">{closeResult.message}</h4>
                  <p className="mt-2 text-sm font-bold leading-6">
                    {formatPeriodMonth(closeResult.period_month)} kapatıldı. {closeResult.created_carry_forward_count} kalem {formatPeriodMonth(closeResult.target_period_month)} dönemine devredildi.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-500">
              Raporu görmek için dönem seçip “Raporu Hazırla” butonuna bas.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ReportMetric({
  title,
  value,
  subtitle,
  strong = false,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  strong?: boolean;
  tone?: "default" | "warning";
}) {
  const toneClasses = tone === "warning" ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-white";

  return (
    <div className={`rounded-[1.25rem] border p-4 shadow-sm ${toneClasses}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <p className={`mt-2 ${strong ? "text-2xl" : "text-lg"} font-black text-slate-950`}>
        {value}
      </p>
      {subtitle ? <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function IssueRow({ issue }: { issue: PeriodClosingIssue }) {
  const classes = issue.blocking
    ? "border-rose-100 bg-rose-50 text-rose-950"
    : "border-amber-100 bg-white text-amber-950";

  return (
    <div className={`rounded-[1.25rem] border p-4 ${classes}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-black">{issue.message}</p>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] opacity-75">
          {issue.blocking ? "Engel" : "Uyarı"}
        </span>
      </div>
    </div>
  );
}
