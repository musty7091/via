import { useEffect, useMemo, useState } from "react";

import {
  approveEventFinancialClosure,
  fetchEventFinancialClosureChecklist,
  fetchEvents,
  fetchLatestEventFinancialClosure,
  prepareEventFinancialClosure,
  reopenEventFinancialClosure,
} from "../api/financeCenterApi";
import type {
  EventFinancialClosureChecklistResponse,
  EventFinancialClosureRead,
  EventRead,
  FinancialClosureChecklistItem,
} from "../types/financeCenterTypes";

type EventFinancialClosureSectionProps = {
  focusKey?: number;
  onChanged: () => Promise<void> | void;
};

type NextAction = {
  title: string;
  message: string;
  tone: "ready" | "blocked";
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

function getClosureStatusLabel(status: string | null | undefined) {
  const labels: Record<string, string> = {
    prepared: "Ön Hazırlık",
    approved: "Onaylandı",
    reopened: "Tekrar Açıldı",
    open: "Açık",
  };

  return labels[status ?? ""] ?? status ?? "Kapanış yok";
}

function getClosureStatusClasses(status: string | null | undefined) {
  if (status === "approved") {
    return "bg-teal-100 text-teal-800";
  }

  if (status === "prepared") {
    return "bg-amber-100 text-amber-800";
  }

  if (status === "reopened") {
    return "bg-rose-100 text-rose-800";
  }

  return "bg-slate-100 text-slate-700";
}

function getChecklistClasses(item: FinancialClosureChecklistItem) {
  if (item.severity === "ok") {
    return "border-teal-100 bg-teal-50 text-teal-950";
  }

  if (item.severity === "warning") {
    return "border-amber-100 bg-amber-50 text-amber-950";
  }

  return "border-rose-100 bg-rose-50 text-rose-950";
}

function getChecklistIcon(item: FinancialClosureChecklistItem) {
  if (item.severity === "ok") {
    return "✓";
  }

  if (item.severity === "warning") {
    return "!";
  }

  return "×";
}

function getEventLabel(eventItem: EventRead) {
  const code = eventItem.event_code ? `${eventItem.event_code} · ` : "";
  return `${code}${eventItem.title} · ${formatDate(eventItem.event_date)}`;
}

function getBlockingItems(snapshot: EventFinancialClosureChecklistResponse) {
  return snapshot.checklist.filter((item) => item.blocking && !item.is_ok);
}

function getWarningItems(snapshot: EventFinancialClosureChecklistResponse) {
  return snapshot.checklist.filter((item) => item.severity === "warning");
}

function getNextAction(snapshot: EventFinancialClosureChecklistResponse): NextAction {
  const blockingItems = getBlockingItems(snapshot);

  if (snapshot.closure_ready) {
    return {
      title: "Kapanışa hazır",
      message:
        "Kırmızı engel kalmadı. Rakamları son kez kontrol edip finansal kapanışı onaylayabilirsin.",
      tone: "ready",
    };
  }

  const firstBlockingItem = blockingItems[0];

  if (!firstBlockingItem) {
    return {
      title: "Kontrol gerekli",
      message: "Kapanışa geçmeden önce ekrandaki uyarıları kontrol et.",
      tone: "blocked",
    };
  }

  if (firstBlockingItem.key === "agreement_confirmed") {
    return {
      title: "Önce anlaşma tutarını düzelt",
      message:
        "Bu etkinlikte anlaşma tutarı boş veya sıfır görünüyor. Etkinlik kartındaki tutar tamamlanmadan kapanış yapılamaz.",
      tone: "blocked",
    };
  }

  if (firstBlockingItem.key === "payment_plan_matched") {
    return {
      title: "Önce ödeme planını tamamla",
      message:
        "Ödeme planı yok veya anlaşma tutarını karşılamıyor. Etkinlik ödeme planı anlaşma tutarını karşılamalı.",
      tone: "blocked",
    };
  }

  if (firstBlockingItem.key === "collection_completed") {
    return {
      title: "Önce müşteri tahsilatını tamamla",
      message: `${formatMoney(
        snapshot.remaining_customer_receivable_base_amount
      )} müşteri alacağı açık görünüyor. Tahsilat tamamlanmadan kapanış onaylanamaz.`,
      tone: "blocked",
    };
  }

  if (firstBlockingItem.key === "supplier_debts_closed") {
    return {
      title: "Önce sanatçı / hizmet borcunu kapat",
      message: `${formatMoney(
        snapshot.remaining_supplier_payable_base_amount
      )} açık sanatçı/hizmet borcu var. Bu borç ödenmeli veya devir mantığıyla kapatılmalı.`,
      tone: "blocked",
    };
  }

  if (firstBlockingItem.key === "partner_cash_closed") {
    return {
      title: "Önce ortaktaki parayı teslim al",
      message: `${formatMoney(
        snapshot.partner_cash_on_hand_base_amount
      )} ortak üzerinde görünüyor. Bu para şirkete teslim alınmadan etkinlik kapatılamaz.`,
      tone: "blocked",
    };
  }

  return {
    title: firstBlockingItem.title,
    message: firstBlockingItem.message,
    tone: "blocked",
  };
}

export function EventFinancialClosureSection({
  focusKey = 0,
  onChanged,
}: EventFinancialClosureSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<EventRead[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [checklist, setChecklist] = useState<EventFinancialClosureChecklistResponse | null>(null);
  const [latestClosure, setLatestClosure] = useState<EventFinancialClosureRead | null>(null);
  const [isEventsLoading, setIsEventsLoading] = useState(false);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [closingNote, setClosingNote] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (focusKey <= 0) {
      return;
    }

    setIsOpen(true);

    window.setTimeout(() => {
      document.getElementById("finance-event-closure-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, [focusKey]);

  useEffect(() => {
    if (!isOpen || events.length > 0 || isEventsLoading) {
      return;
    }

    loadEvents();
  }, [events.length, isEventsLoading, isOpen]);

  useEffect(() => {
    if (!selectedEventId) {
      setChecklist(null);
      setLatestClosure(null);
      return;
    }

    loadEventClosure(Number(selectedEventId));
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((eventItem) => String(eventItem.id) === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const blockingItems = checklist ? getBlockingItems(checklist) : [];
  const warningItems = checklist ? getWarningItems(checklist) : [];
  const nextAction = checklist ? getNextAction(checklist) : null;

  async function loadEvents() {
    setIsEventsLoading(true);
    setErrorMessage(null);

    try {
      const items = await fetchEvents();
      const sortedItems = [...items].sort((first, second) =>
        String(second.event_date ?? "").localeCompare(String(first.event_date ?? ""))
      );

      setEvents(sortedItems);

      if (!selectedEventId && sortedItems.length > 0) {
        setSelectedEventId(String(sortedItems[0].id));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Etkinlik listesi alınamadı.");
    } finally {
      setIsEventsLoading(false);
    }
  }

  async function loadEventClosure(eventId: number) {
    setIsSnapshotLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const [snapshot, latest] = await Promise.all([
        fetchEventFinancialClosureChecklist(eventId),
        fetchLatestEventFinancialClosure(eventId),
      ]);

      setChecklist(snapshot);
      setLatestClosure(latest);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Etkinlik finans kapanışı bilgileri alınamadı."
      );
    } finally {
      setIsSnapshotLoading(false);
    }
  }

  async function handleRefresh() {
    if (!selectedEventId) {
      await loadEvents();
      return;
    }

    await loadEventClosure(Number(selectedEventId));
  }

  async function handlePrepareClosure() {
    if (!selectedEventId) {
      setErrorMessage("Önce bir etkinlik seçmelisin.");
      return;
    }

    setIsPreparing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const closure = await prepareEventFinancialClosure(Number(selectedEventId), {
        closing_note: closingNote.trim() || null,
      });

      setLatestClosure(closure);
      setClosingNote("");
      setSuccessMessage("Kontrol amaçlı ön kapanış kaydı oluşturuldu.");
      await loadEventClosure(Number(selectedEventId));
      await onChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Ön kapanış oluşturulamadı.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleApproveClosure() {
    if (!selectedEventId) {
      setErrorMessage("Önce bir etkinlik seçmelisin.");
      return;
    }

    if (!checklist?.closure_ready) {
      setErrorMessage(
        "Bu etkinlikte kapanışı engelleyen eksikler var. Önce kırmızı başlıkları tamamla."
      );
      return;
    }

    setIsApproving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const closure = await approveEventFinancialClosure(Number(selectedEventId), {
        approval_note: approvalNote.trim() || null,
      });

      setLatestClosure(closure);
      setApprovalNote("");
      setSuccessMessage("Etkinlik finansal olarak onaylandı ve kapatıldı.");
      await loadEventClosure(Number(selectedEventId));
      await onChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Etkinlik finans kapanışı onaylanamadı.");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReopenClosure() {
    if (!selectedEventId) {
      setErrorMessage("Önce bir etkinlik seçmelisin.");
      return;
    }

    if (!reopenReason.trim()) {
      setErrorMessage("Tekrar açma nedeni zorunludur.");
      return;
    }

    setIsReopening(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const closure = await reopenEventFinancialClosure(Number(selectedEventId), {
        reopen_reason: reopenReason.trim(),
      });

      setLatestClosure(closure);
      setReopenReason("");
      setSuccessMessage("Onaylı etkinlik finans kapanışı tekrar açıldı.");
      await loadEventClosure(Number(selectedEventId));
      await onChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Etkinlik kapanışı tekrar açılamadı.");
    } finally {
      setIsReopening(false);
    }
  }

  return (
    <section id="finance-event-closure-section" className="rounded-[2rem] bg-white p-5 shadow-xl shadow-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
            Etkinlik Finans Kapanışı
          </p>
          <h3 className="mt-1 text-2xl font-black">Açık etkinliği kapat</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Önce etkinliği seç. Sistem sana kapanışa engel olan eksikleri ve sıradaki yapılacak işi gösterecek.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextIsOpen = !isOpen;
            setIsOpen(nextIsOpen);

            if (nextIsOpen) {
              window.setTimeout(() => {
                document.getElementById("finance-event-closure-section")?.scrollIntoView({
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
                1. Etkinlik seç
              </span>
              <select
                value={selectedEventId}
                onChange={(event) => {
                  setSelectedEventId(event.target.value);
                  setShowNumbers(false);
                  setShowChecklist(false);
                  setShowAdvancedActions(false);
                }}
                disabled={isEventsLoading}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-teal-400 disabled:opacity-60"
              >
                <option value="">
                  {isEventsLoading ? "Etkinlikler yükleniyor..." : "Etkinlik seç"}
                </option>
                {events.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {getEventLabel(eventItem)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isEventsLoading || isSnapshotLoading}
                className="h-12 rounded-full border border-slate-200 bg-white px-5 text-xs font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-60"
              >
                Yenile
              </button>
            </div>
          </div>

          {selectedEvent ? (
            <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Seçili Etkinlik
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{selectedEvent.title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedEvent.event_code || "Kod yok"} · {formatDate(selectedEvent.event_date)} · {selectedEvent.status}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600">
                  Etkinlik ID: {selectedEvent.id}
                </span>
              </div>
            </div>
          ) : null}

          {isSnapshotLoading ? (
            <div className="rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold text-slate-500">
              Etkinlik finans kapanışı hesaplanıyor...
            </div>
          ) : null}

          {checklist && nextAction ? (
            <>
              <div
                className={`rounded-[1.5rem] border p-5 ${
                  nextAction.tone === "ready"
                    ? "border-teal-100 bg-teal-50 text-teal-950"
                    : "border-rose-100 bg-rose-50 text-rose-950"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">
                      2. Sistem yorumu
                    </p>
                    <h4 className="mt-2 text-2xl font-black">{nextAction.title}</h4>
                    <p className="mt-2 text-sm font-bold leading-6 opacity-80">
                      {nextAction.message}
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] bg-white/70 px-5 py-4 text-right shadow-sm">
                    <p className="text-3xl font-black">{checklist.blocking_issue_count}</p>
                    <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">Engel</p>
                    <p className="mt-1 text-sm font-black">{checklist.warning_count} uyarı</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MiniMetric
                  title="Tahsilat Durumu"
                  value={formatMoney(checklist.collected_base_amount)}
                  subtitle={`Plan: ${formatMoney(checklist.planned_base_amount)} · Anlaşma: ${formatMoney(checklist.agreement_base_amount)}`}
                />
                <MiniMetric
                  title="Kalan Müşteri Alacağı"
                  value={formatMoney(checklist.remaining_customer_receivable_base_amount)}
                  tone={checklist.remaining_customer_receivable_base_amount > 0 ? "danger" : "default"}
                />
                <MiniMetric
                  title="Açık Sanatçı/Hizmet Borcu"
                  value={formatMoney(checklist.remaining_supplier_payable_base_amount)}
                  tone={checklist.remaining_supplier_payable_base_amount > 0 ? "danger" : "default"}
                />
                <MiniMetric
                  title="Operasyonel Kâr/Zarar"
                  value={formatMoney(checklist.operational_profit_base_amount)}
                  strong
                />
              </div>

              {blockingItems.length > 0 ? (
                <div className="rounded-[1.5rem] border border-rose-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-400">
                    3. Önce bunları tamamla
                  </p>
                  <div className="mt-4 space-y-3">
                    {blockingItems.map((item) => (
                      <ChecklistRow key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-teal-100 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-500">
                    3. Final onay
                  </p>
                  <h4 className="mt-1 text-xl font-black">Bu etkinlik kapanışa hazır</h4>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                    Kapanışı onaylarsan bu etkinlik finansal olarak kapanmış sayılır.
                  </p>
                  <textarea
                    value={approvalNote}
                    onChange={(event) => setApprovalNote(event.target.value)}
                    className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
                    placeholder="Onay notu"
                  />
                  <button
                    type="button"
                    onClick={handleApproveClosure}
                    disabled={isApproving || !checklist.closure_ready}
                    className="mt-4 rounded-full bg-teal-600 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isApproving ? "Onaylanıyor..." : "Finansal Kapanışı Onayla"}
                  </button>
                </div>
              )}

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Son Kapanış Kaydı
                    </p>
                    <p className="mt-1 text-lg font-black">
                      {latestClosure ? getClosureStatusLabel(latestClosure.status) : "Henüz kapanış kaydı yok"}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-2 text-xs font-black ${getClosureStatusClasses(latestClosure?.status)}`}>
                    {getClosureStatusLabel(latestClosure?.status)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <ToggleButton
                  label={showNumbers ? "Rakam detaylarını gizle" : "Rakam detaylarını göster"}
                  onClick={() => setShowNumbers((previous) => !previous)}
                />
                <ToggleButton
                  label={showChecklist ? "Tüm kontrolleri gizle" : "Tüm kontrolleri göster"}
                  onClick={() => setShowChecklist((previous) => !previous)}
                />
                <ToggleButton
                  label={showAdvancedActions ? "Ek işlemleri gizle" : "Ek işlemleri göster"}
                  onClick={() => setShowAdvancedActions((previous) => !previous)}
                />
              </div>

              {showNumbers ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <MiniMetric title="Anlaşma" value={formatMoney(checklist.agreement_base_amount)} />
                  <MiniMetric title="Ödeme Planı" value={formatMoney(checklist.planned_base_amount)} />
                  <MiniMetric title="Tahsil Edilen" value={formatMoney(checklist.collected_base_amount)} />
                  <MiniMetric title="Kalan Müşteri Alacağı" value={formatMoney(checklist.remaining_customer_receivable_base_amount)} />
                  <MiniMetric title="Sanatçı/Hizmet Maliyeti" value={formatMoney(checklist.total_event_cost_base_amount)} />
                  <MiniMetric title="Etkinlik Gideri" value={formatMoney(checklist.total_expense_base_amount)} />
                  <MiniMetric title="Açık Sanatçı/Hizmet Borcu" value={formatMoney(checklist.remaining_supplier_payable_base_amount)} />
                  <MiniMetric title="Ortak Üzerindeki Para" value={formatMoney(checklist.partner_cash_on_hand_base_amount)} />
                  <MiniMetric title="Şirketin Ortaktan Alacağı" value={formatMoney(checklist.company_receivable_from_partner_base_amount)} />
                  <MiniMetric title="Şirketin Ortağa Borcu" value={formatMoney(checklist.company_payable_to_partner_base_amount)} />
                  <MiniMetric title="Operasyonel Kâr/Zarar" value={formatMoney(checklist.operational_profit_base_amount)} strong />
                </div>
              ) : null}

              {showChecklist ? (
                <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                        Tüm Kontrol Listesi
                      </p>
                      <h4 className="mt-1 text-xl font-black">Kapanış öncesi kontroller</h4>
                    </div>
                    <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600">
                      {formatPeriodMonth(checklist.period_month)} · {warningItems.length} uyarı
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {checklist.checklist.map((item) => (
                      <ChecklistRow key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              ) : null}

              {showAdvancedActions ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                      Opsiyonel Kontrol Kaydı
                    </p>
                    <h4 className="mt-1 text-xl font-black">Ön kapanış hazırla</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Bu sadece kontrol amaçlı anlık görüntü kaydıdır. Final onay değildir.
                    </p>
                    <textarea
                      value={closingNote}
                      onChange={(event) => setClosingNote(event.target.value)}
                      className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-teal-400"
                      placeholder="Ön kapanış notu"
                    />
                    <button
                      type="button"
                      onClick={handlePrepareClosure}
                      disabled={isPreparing}
                      className="mt-4 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPreparing ? "Hazırlanıyor..." : "Ön Kapanış Kaydı Oluştur"}
                    </button>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                      Son Kayıt Detayı
                    </p>
                    {latestClosure ? (
                      <div className="mt-3 grid gap-3">
                        <MiniMetric title="Versiyon" value={String(latestClosure.closure_version)} />
                        <MiniMetric title="Dönem" value={formatPeriodMonth(latestClosure.period_month)} />
                        <MiniMetric title="Kâr/Zarar" value={formatMoney(latestClosure.operational_profit_base_amount)} strong />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
                        Bu etkinlik için henüz ön kapanış veya onaylı finans kapanışı oluşturulmamış.
                      </p>
                    )}

                    {latestClosure?.status === "approved" ? (
                      <div className="mt-5 rounded-[1.25rem] border border-amber-100 bg-amber-50 p-4">
                        <p className="font-black text-amber-950">Onaylı kapanışı tekrar aç</p>
                        <p className="mt-1 text-sm font-bold leading-6 text-amber-900">
                          Sadece hatalı kapanış düzeltilecekse kullan. Tekrar açma nedeni zorunludur.
                        </p>
                        <textarea
                          value={reopenReason}
                          onChange={(event) => setReopenReason(event.target.value)}
                          className="mt-3 min-h-20 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-amber-400"
                          placeholder="Tekrar açma nedeni"
                        />
                        <button
                          type="button"
                          onClick={handleReopenClosure}
                          disabled={isReopening}
                          className="mt-3 rounded-full bg-amber-700 px-5 py-3 text-sm font-black text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isReopening ? "Açılıyor..." : "Kapanışı Tekrar Aç"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function MiniMetric({
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
  tone?: "default" | "danger";
}) {
  const toneClasses = tone === "danger" ? "border-rose-100 bg-rose-50" : "border-slate-100 bg-white";

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

function ChecklistRow({ item }: { item: FinancialClosureChecklistItem }) {
  return (
    <div className={`rounded-[1.25rem] border p-4 ${getChecklistClasses(item)}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm">
          {getChecklistIcon(item)}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{item.title}</p>
            {item.blocking ? (
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] opacity-75">
                Zorunlu
              </span>
            ) : (
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black uppercase tracking-[0.12em] opacity-75">
                Uyarı
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-bold leading-6 opacity-80">{item.message}</p>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
    >
      {label}
    </button>
  );
}
