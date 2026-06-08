import { useEffect, useMemo, useState } from "react";

import { closePeriod, fetchPeriodClosingPreview } from "../api/financeCenterApi";
import type {
  PeriodCloseResponse,
  PeriodClosingIssue,
  PeriodClosingPreviewItem,
  PeriodClosingPreviewResponse,
} from "../types/financeCenterTypes";


function escapeReportHtml(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatReportMoney(value: unknown) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatReportNumber(value: unknown, maximumFractionDigits = 4) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatReportDate(value: unknown) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(String(value)));
  } catch {
    return String(value);
  }
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: "Onaylandı",
    prepared: "Ön kapanış",
    reopened: "Tekrar açıldı",
    open: "Açık",
    not_prepared: "Hazırlanmadı",
  };

  return labels[status] ?? status;
}

function reportBalanceLabel(direction: string) {
  if (direction === "company_owes_partner") {
    return "Şirket ortağa borçlu";
  }

  if (direction === "partner_owes_company") {
    return "Ortak şirkete borçlu";
  }

  return "Dengede";
}


function reportCarryTypeLabel(item: any) {
  if (item.source_reference_type === "period_profit_share") {
    return "Ortak Kâr Payı";
  }

  const labels: Record<string, string> = {
    open_event: "Açık Etkinlik",
    customer_receivable: "Müşteri Alacağı",
    supplier_payable: "Sanatçı / Hizmet Borcu",
    partner_cash_on_hand: "Ortak Üzerindeki Şirket Parası",
    company_payable_to_partner: "Şirketin Ortağa Borcu",
  };

  return labels[item.carry_type] ?? "Diğer Devir Kalemi";
}

function reportCarryReasonText(item: any) {
  if (item.source_reference_type === "period_profit_share") {
    return "Ortağın dönem kâr payı sonraki dönemde ortak cari hesabında alacak olarak takip edilecek.";
  }

  if (item.carry_type === "open_event") {
    return "Bu etkinliğin finansal kapanışı henüz onaylanmadı. Sonraki dönemde açık etkinlik olarak takip edilecek.";
  }

  if (item.carry_type === "customer_receivable") {
    return "Müşteriden tahsil edilecek kalan bakiye sonraki döneme aktarılacak.";
  }

  if (item.carry_type === "supplier_payable") {
    return "Ödenmemiş sanatçı veya hizmet borcu sonraki döneme aktarılacak.";
  }

  if (item.carry_type === "partner_cash_on_hand") {
    return "Ortağın üzerinde bulunan şirket tahsilatı sonraki dönemde teslim alınmak üzere takip edilecek.";
  }

  if (item.carry_type === "company_payable_to_partner") {
    return "Şirketin ortağa olan açık borcu sonraki dönemde ortak cari hesabında takip edilecek.";
  }

  return item.carry_reason ?? "Sonraki döneme aktarılacak açık kalem.";
}

function buildReportMetric(label: string, value: string, note = "") {
  return `
    <div class="metric">
      <div class="metric-label">${escapeReportHtml(label)}</div>
      <div class="metric-value">${escapeReportHtml(value)}</div>
      ${note ? `<div class="metric-note">${escapeReportHtml(note)}</div>` : ""}
    </div>
  `;
}

function buildPeriodClosingPdfHtml(preview: any) {
  const summary = preview.summary;
  const partnerSummaries = preview.partner_summaries ?? [];
  const eventSummaries = preview.event_summaries ?? [];
  const carryItems = preview.carry_forward_items ?? [];
  const generatedAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const summaryMetrics = [
    buildReportMetric("Etkinlik Sayısı", String(summary.event_count ?? 0), `Açık etkinlik: ${summary.open_event_count ?? 0}`),
    buildReportMetric("Dönem Geliri", formatReportMoney(summary.total_revenue_base_amount)),
    buildReportMetric("Etkinlik Maliyeti", formatReportMoney(summary.total_event_cost_base_amount)),
    buildReportMetric("Etkinlik Gideri", formatReportMoney(summary.total_event_expense_base_amount)),
    buildReportMetric("Genel Gider", formatReportMoney((summary.total_general_expense_base_amount ?? 0) + (summary.total_allocated_expense_base_amount ?? 0))),
    buildReportMetric("Net Kâr / Zarar", formatReportMoney(summary.net_profit_base_amount)),
    buildReportMetric("Müşteri Alacağı Devri", formatReportMoney(summary.customer_receivable_base_amount)),
    buildReportMetric("Sanatçı / Hizmet Borcu Devri", formatReportMoney(summary.supplier_payable_base_amount)),
    buildReportMetric("Ortak Üzerindeki Para", formatReportMoney(summary.partner_cash_on_hand_base_amount)),
    buildReportMetric("Şirketin Ortağa Borcu", formatReportMoney(summary.company_payable_to_partner_base_amount)),
  ].join("");

  const partnerRows = partnerSummaries
    .map((partner: any) => `
      <tr>
        <td>${escapeReportHtml(partner.partner_name)}</td>
        <td class="right">%${formatReportNumber(partner.ownership_percent)}</td>
        <td class="right">${formatReportMoney(partner.profit_share_base_amount)}</td>
        <td class="right">${formatReportMoney(partner.partner_cash_on_hand_base_amount)}</td>
        <td class="right">${formatReportMoney(partner.company_payable_to_partner_base_amount)}</td>
        <td class="right strong">${formatReportMoney(Math.abs(Number(partner.net_company_payable_to_partner_base_amount ?? 0)))}</td>
        <td>${escapeReportHtml(reportBalanceLabel(partner.balance_direction))}</td>
      </tr>
    `)
    .join("");

  const eventRows = eventSummaries
    .map((eventItem: any, index: number) => {
      const partnerShares = (eventItem.partner_profit_shares ?? [])
        .map((share: any) => `${escapeReportHtml(share.partner_name)}: ${escapeReportHtml(formatReportMoney(share.profit_share_base_amount))}`)
        .join("<br />");

      const carryLabels = (eventItem.carry_forward_labels ?? []).length > 0
        ? (eventItem.carry_forward_labels ?? []).map((item: string) => escapeReportHtml(item)).join(", ")
        : "Devir yok";

      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>
            <div class="strong">${escapeReportHtml(eventItem.customer_name ?? "Müşteri yok")}</div>
            <div>${escapeReportHtml(eventItem.event_title)}</div>
            <div class="muted">${escapeReportHtml(eventItem.event_code ?? `#${eventItem.event_id}`)}</div>
            ${eventItem.event_notes ? `<div class="tiny">${escapeReportHtml(eventItem.event_notes)}</div>` : ""}
          </td>
          <td>${escapeReportHtml(formatReportDate(eventItem.event_date))}</td>
          <td class="right">${formatReportMoney(eventItem.agreement_base_amount)}</td>
          <td class="right">${formatReportMoney(eventItem.collected_base_amount)}</td>
          <td class="right">${formatReportMoney(eventItem.remaining_customer_receivable_base_amount)}</td>
          <td class="right">${formatReportMoney(eventItem.supplier_payable_base_amount)}</td>
          <td class="right">${formatReportMoney(eventItem.remaining_supplier_payable_base_amount)}</td>
          <td class="right">${formatReportMoney(eventItem.event_expense_base_amount)}</td>
          <td class="right strong">${formatReportMoney(eventItem.operational_profit_base_amount)}</td>
          <td>
            <div>${escapeReportHtml(reportStatusLabel(eventItem.financial_closure_status))}</div>
            <div class="tiny">${escapeReportHtml(carryLabels)}</div>
          </td>
          <td>${partnerShares || "-"}</td>
        </tr>
      `;
    })
    .join("");

  const carryRows = carryItems
    .map((item: any) => `
      <tr>
        <td>${escapeReportHtml(reportCarryTypeLabel(item))}</td>
        <td>${escapeReportHtml(item.event_title ?? "-")}</td>
        <td class="right">${formatReportMoney(item.base_amount)}</td>
        <td>${escapeReportHtml(reportCarryReasonText(item))}</td>
      </tr>
    `)
    .join("");

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>VIA EVENTS - ${escapeReportHtml(summary.period_month)} Dönem Kapanış Raporu</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.35;
    }

    .report {
      width: 100%;
    }

    .cover {
      border: 1px solid #d9e2ea;
      border-radius: 18px;
      padding: 18px;
      margin-bottom: 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #eefcf9 100%);
      page-break-inside: avoid;
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }

    .logo {
      max-width: 210px;
      max-height: 70px;
      object-fit: contain;
    }

    .brand-fallback {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 1.5px;
      color: #0f172a;
    }

    .title-block {
      text-align: right;
    }

    .title {
      font-size: 24px;
      font-weight: 900;
      margin: 0;
      color: #0f172a;
      letter-spacing: -0.5px;
    }

    .subtitle {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #0f766e;
    }

    .meta {
      margin-top: 7px;
      color: #475569;
      font-weight: 700;
    }

    .section {
      margin-top: 14px;
      page-break-inside: avoid;
    }

    .section-title {
      margin: 0 0 8px 0;
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      border-left: 5px solid #0f766e;
      padding-left: 8px;
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }

    .metric {
      border: 1px solid #d9e2ea;
      border-radius: 12px;
      padding: 8px;
      background: #ffffff;
      min-height: 58px;
    }

    .metric-label {
      font-size: 8px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #64748b;
    }

    .metric-value {
      margin-top: 5px;
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
    }

    .metric-note {
      margin-top: 3px;
      color: #64748b;
      font-weight: 700;
      font-size: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      background: #ffffff;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 6px;
      border: 1px solid #0f172a;
      vertical-align: top;
    }

    td {
      padding: 6px;
      border: 1px solid #d9e2ea;
      vertical-align: top;
      color: #0f172a;
    }

    tbody tr:nth-child(even) td {
      background: #f8fafc;
    }

    .right {
      text-align: right;
      white-space: nowrap;
    }

    .center {
      text-align: center;
    }

    .strong {
      font-weight: 900;
    }

    .muted {
      color: #64748b;
      font-weight: 700;
      margin-top: 2px;
    }

    .tiny {
      color: #64748b;
      font-size: 8px;
      font-weight: 700;
      margin-top: 3px;
    }

    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #d9e2ea;
      color: #64748b;
      font-size: 8px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .page-break {
      page-break-before: always;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <main class="report">
    <section class="cover">
      <div class="header">
        <div>
          <img class="logo" src="/brand/via-logo-horizontal.png" alt="VIA EVENTS" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <div class="brand-fallback" style="display:none;">VIA EVENTS</div>
        </div>
        <div class="title-block">
          <h1 class="title">Dönem Kapanış Raporu</h1>
          <div class="subtitle">${escapeReportHtml(summary.period_month)} dönemi / ${escapeReportHtml(summary.target_period_month)} devri</div>
          <div class="meta">Hazırlanma: ${escapeReportHtml(generatedAt)}</div>
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">1. Genel Dönem Özeti</h2>
        <div class="metrics">${summaryMetrics}</div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">2. Etkinlik Bazlı Ayrıntılı Rapor</h2>
      <table>
        <thead>
          <tr>
            <th style="width:26px;">#</th>
            <th style="width:230px;">Müşteri / Etkinlik</th>
            <th>Tarih</th>
            <th>Anlaşma</th>
            <th>Tahsilat</th>
            <th>Kalan Alacak</th>
            <th>Maliyet</th>
            <th>Açık Borç</th>
            <th>Gider</th>
            <th>Kâr/Zarar</th>
            <th>Durum / Devir</th>
            <th>Ortak Kâr Payları</th>
          </tr>
        </thead>
        <tbody>
          ${eventRows || `<tr><td colspan="12" class="center">Bu dönem için etkinlik kaydı bulunamadı.</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="section page-break">
      <h2 class="section-title">3. Ortak Hesap Özeti</h2>
      <table>
        <thead>
          <tr>
            <th>Ortak</th>
            <th>Hisse</th>
            <th>Dönem Kâr Payı</th>
            <th>Ortak Üzerindeki Para</th>
            <th>Şirketin Ortağa Eski Borcu</th>
            <th>Net Ortak Bakiyesi</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          ${partnerRows || `<tr><td colspan="7" class="center">Aktif ortak kaydı bulunamadı.</td></tr>`}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2 class="section-title">4. Sonraki Döneme Aktarılacak Kalemler</h2>
      <table>
        <thead>
          <tr>
            <th>Kalem Türü</th>
            <th>İlgili Etkinlik</th>
            <th>Tutar</th>
            <th>Açıklama</th>
          </tr>
        </thead>
        <tbody>
          ${carryRows || `<tr><td colspan="4" class="center">Devreden açık kalem bulunmuyor.</td></tr>`}
        </tbody>
      </table>
    </section>

    <div class="footer">
      <div>VIA EVENTS - Finans Merkezi</div>
      <div>Bu rapor VIA EVENTS Finans Merkezi tarafından hazırlanmıştır.</div>
    </div>
  </main>
</body>
</html>`;
}


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



function getClosureStatusLabel(status: string) {
  const labels: Record<string, string> = {
    approved: "Onaylandı",
    prepared: "Ön kapanış",
    reopened: "Tekrar açıldı",
    open: "Açık",
    not_prepared: "Hazırlanmadı",
  };

  return labels[status] ?? status;
}

function formatEventDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPartnerShares(
  shares: { partner_name: string; profit_share_base_amount: number; ownership_percent: number }[]
) {
  if (shares.length === 0) {
    return "-";
  }

  return shares
    .map(
      (share) =>
        `${share.partner_name}: ${formatMoney(share.profit_share_base_amount)}`
    )
    .join(" / ");
}

function getPartnerBalanceLabel(direction: string) {
  if (direction === "company_owes_partner") {
    return "Şirket ortağa borçlu";
  }

  if (direction === "partner_owes_company") {
    return "Ortak şirkete borçlu";
  }

  return "Dengede";
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
  const isPeriodClosedOrJustClosed = Boolean(summary?.source_period_is_locked || closeResult);

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
    !isPeriodClosedOrJustClosed &&
    confirmText.trim().toLocaleUpperCase("tr-TR") === "KAPAT";

  function handlePrintReport() {
    if (!preview) {
      window.alert("Önce dönem kapanış raporunu hazırlayın.");
      return;
    }

    const reportWindow = window.open("", "_blank", "width=1400,height=900");

    if (!reportWindow) {
      window.alert("Rapor penceresi açılamadı. Tarayıcı açılır pencere iznini kontrol edin.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(buildPeriodClosingPdfHtml(preview));
    reportWindow.document.close();
    reportWindow.focus();

    setTimeout(() => {
      reportWindow.print();
    }, 700);
  }

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

    if (isPeriodClosedOrJustClosed) {
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
              <div className="flex flex-wrap items-end gap-3">
                {summary ? (
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="h-12 rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                  >
                    Profesyonel PDF Raporu
                  </button>
                ) : null}
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
                  isPeriodClosedOrJustClosed
                    ? "border-teal-100 bg-teal-50 text-teal-950"
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
                      {isPeriodClosedOrJustClosed
                        ? "Bu dönem kapalı"
                        : summary.can_close_period
                          ? "Dönem kapanışa hazır"
                          : "Dönem kapatılamaz"}
                    </h4>
                    <p className="mt-2 text-sm font-bold leading-6 opacity-80">
                      {isPeriodClosedOrJustClosed
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



              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                      3. Etkinlik Bazlı Detay
                    </p>
                    <h4 className="mt-1 text-xl font-black">
                      Her etkinliğin gelir, maliyet, tahsilat ve ortak kâr payı
                    </h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Bu tablo PDF çıktısında ay içindeki her etkinliği ayrı satır olarak gösterir.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
                    {(preview?.event_summaries ?? []).length} etkinlik
                  </span>
                </div>

                {(preview?.event_summaries ?? []).length === 0 ? (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
                    Bu dönem için etkinlik detayı bulunmuyor.
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-[1200px] w-full border-separate border-spacing-y-2 text-left text-sm">
                      <thead>
                        <tr className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          <th className="px-3 py-2">Müşteri / Etkinlik</th>
                          <th className="px-3 py-2">Tarih</th>
                          <th className="px-3 py-2 text-right">Anlaşma</th>
                          <th className="px-3 py-2 text-right">Tahsilat</th>
                          <th className="px-3 py-2 text-right">Kalan Alacak</th>
                          <th className="px-3 py-2 text-right">Maliyet</th>
                          <th className="px-3 py-2 text-right">Gider</th>
                          <th className="px-3 py-2 text-right">Kâr/Zarar</th>
                          <th className="px-3 py-2">Durum</th>
                          <th className="px-3 py-2">Ortak Kâr Payları</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview?.event_summaries ?? []).map((eventItem) => (
                          <tr key={eventItem.event_id} className="align-top">
                            <td className="rounded-l-2xl bg-slate-50 px-3 py-3">
                              <p className="font-black text-slate-950">
                                {eventItem.customer_name ?? "Müşteri yok"}
                              </p>
                              <p className="mt-1 font-bold text-slate-600">
                                {eventItem.event_title}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                {eventItem.event_code ?? `#${eventItem.event_id}`}
                              </p>
                              {eventItem.event_notes ? (
                                <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                                  {eventItem.event_notes}
                                </p>
                              ) : null}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 font-bold text-slate-600">
                              {formatEventDate(eventItem.event_date)}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 text-right font-black">
                              {formatMoney(eventItem.agreement_base_amount)}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 text-right font-black text-teal-700">
                              {formatMoney(eventItem.collected_base_amount)}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 text-right font-black text-amber-700">
                              {formatMoney(eventItem.remaining_customer_receivable_base_amount)}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 text-right font-black">
                              {formatMoney(eventItem.supplier_payable_base_amount)}
                              {eventItem.remaining_supplier_payable_base_amount > 0 ? (
                                <p className="mt-1 text-xs font-bold text-rose-600">
                                  Açık: {formatMoney(eventItem.remaining_supplier_payable_base_amount)}
                                </p>
                              ) : null}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 text-right font-black">
                              {formatMoney(eventItem.event_expense_base_amount)}
                            </td>
                            <td className="bg-slate-50 px-3 py-3 text-right font-black">
                              {formatMoney(eventItem.operational_profit_base_amount)}
                            </td>
                            <td className="bg-slate-50 px-3 py-3">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                                eventItem.is_financially_approved
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}>
                                {getClosureStatusLabel(eventItem.financial_closure_status)}
                              </span>
                              {eventItem.carry_forward_labels.length > 0 ? (
                                <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                                  Devir: {eventItem.carry_forward_labels.join(", ")}
                                </p>
                              ) : (
                                <p className="mt-2 text-xs font-bold text-teal-700">
                                  Devir yok
                                </p>
                              )}
                            </td>
                            <td className="rounded-r-2xl bg-slate-50 px-3 py-3 text-xs font-bold leading-5 text-slate-600">
                              {formatPartnerShares(eventItem.partner_profit_shares)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-indigo-100 bg-indigo-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-500">
                      4. Ortak Hesap Özeti
                    </p>
                    <h4 className="mt-1 text-xl font-black text-slate-950">
                      Dönem kârı ve ortak cari etkisi
                    </h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                      Net kâr ortaklık oranlarına göre dağıtılır. Ortağın üzerindeki şirket parası varsa net alacağından düşülür.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-indigo-700 shadow-sm">
                    {summary.net_profit_base_amount >= 0 ? "Kâr dağıtımı" : "Zarar dönemi"}
                  </span>
                </div>

                {(preview?.partner_summaries ?? []).length === 0 ? (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-indigo-200 bg-white/70 p-5 text-sm font-bold text-slate-500">
                    Aktif ortak kaydı bulunamadı.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {(preview?.partner_summaries ?? []).map((partner) => (
                      <div key={partner.partner_id} className="rounded-[1.25rem] border border-white/70 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-slate-950">{partner.partner_name}</p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-indigo-500">
                              %{new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 4 }).format(partner.ownership_percent)} ortaklık
                            </p>
                          </div>
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black text-indigo-700">
                            {getPartnerBalanceLabel(partner.balance_direction)}
                          </span>
                        </div>

                        <div className="mt-4 space-y-2 text-sm font-bold text-slate-600">
                          <div className="flex justify-between gap-3">
                            <span>Dönem kâr payı</span>
                            <span className="text-slate-950">{formatMoney(partner.profit_share_base_amount)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Ortak üzerindeki para</span>
                            <span className="text-slate-950">{formatMoney(partner.partner_cash_on_hand_base_amount)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Şirketin ortağa eski borcu</span>
                            <span className="text-slate-950">{formatMoney(partner.company_payable_to_partner_base_amount)}</span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl bg-slate-950 p-3 text-white">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-teal-200">
                            Net ortak bakiyesi
                          </p>
                          <p className="mt-1 text-lg font-black">
                            {formatMoney(Math.abs(partner.net_company_payable_to_partner_base_amount))}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-300">
                            {getPartnerBalanceLabel(partner.balance_direction)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
                      5. Devredecek kalemler
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

              {!isPeriodClosedOrJustClosed && (preview?.issues ?? []).length > 0 ? (
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
                  6. Kontrollü kapanış
                </p>

                {summary?.source_period_is_locked ? (
                  <div className="mt-4 rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-600">
                    Bu dönem kapalıdır. Kapanış sonucu aşağıda gösterilir.
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
