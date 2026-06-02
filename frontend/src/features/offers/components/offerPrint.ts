import type { OfferPrintView } from "../types/offerTypes";
import { formatDate, formatMoney, formatTime } from "./formatters";
import { getOptionLabel, invoiceTypeOptions, programSectionOptions } from "../constants/offerConstants";

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function openOfferPrintWindow(view: OfferPrintView) {
  const windowRef = window.open("", "_blank", "width=980,height=1200");

  if (!windowRef) {
    alert("Print penceresi açılamadı. Tarayıcı popup engelini kontrol et.");
    return;
  }

  const linesHtml = view.lines
    .map(
      (line) => `
        <tr>
          <td>${escapeHtml(formatTime(line.start_time))}</td>
          <td>${escapeHtml(formatTime(line.end_time))}</td>
          <td>
            <strong>${escapeHtml(line.title)}</strong>
            <div class="muted">${escapeHtml(getOptionLabel(programSectionOptions, line.program_section))}</div>
            <div>${escapeHtml(line.description)}</div>
          </td>
          <td class="right">${escapeHtml(String(line.quantity))}</td>
          <td class="right">${escapeHtml(formatMoney(line.unit_price, line.currency))}</td>
          <td class="right">${escapeHtml(formatMoney(line.line_amount, line.currency))}</td>
        </tr>
      `
    )
    .join("");

  const summariesHtml = view.summaries
    .map(
      (summary) => `
        <div class="summary-card">
          <div class="muted">${escapeHtml(summary.currency)} Teklif Özeti</div>
          <div class="row"><span>Ara Toplam</span><strong>${escapeHtml(formatMoney(summary.visible_amount, summary.currency))}</strong></div>
          <div class="row"><span>KDV</span><strong>${escapeHtml(formatMoney(summary.vat_amount, summary.currency))}</strong></div>
          <div class="row total"><span>Genel Toplam</span><strong>${escapeHtml(formatMoney(summary.total_amount, summary.currency))}</strong></div>
        </div>
      `
    )
    .join("");

  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(view.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; background: #f8fafc; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 22mm 18mm; }
    .brand { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 18px; }
    .brand h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
    .brand p { margin: 6px 0 0 0; color: #475569; }
    .badge { padding: 8px 12px; background: #ccfbf1; border-radius: 999px; font-weight: 700; color: #0f172a; }
    .section { margin-top: 22px; }
    h2 { margin: 0 0 10px 0; font-size: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .box { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #f8fafc; }
    .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .value { margin-top: 5px; font-size: 16px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { text-align: left; background: #0f172a; color: white; padding: 10px; font-size: 12px; }
    td { border-bottom: 1px solid #e2e8f0; padding: 10px; vertical-align: top; font-size: 13px; }
    .right { text-align: right; white-space: nowrap; }
    .muted { color: #64748b; font-size: 12px; margin-top: 3px; }
    .summaries { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #f8fafc; }
    .row { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
    .row.total { border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 17px; }
    .note { white-space: pre-wrap; line-height: 1.55; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #f8fafc; }
    .signature { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 38px; }
    .sign-box { border-top: 1px solid #0f172a; padding-top: 8px; text-align: center; color: #475569; }
    @media print {
      body { background: white; }
      .page { margin: 0; width: auto; min-height: auto; box-shadow: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand">
      <div>
        <h1>VIA EVENTS</h1>
        <p>Etkinlik Program Teklifi</p>
      </div>
      <div class="badge">${escapeHtml(view.offer_no ?? "Teklif")}</div>
    </div>

    <div class="section">
      <h2>${escapeHtml(view.title)}</h2>
      <div class="grid">
        <div class="box"><div class="label">Müşteri</div><div class="value">${escapeHtml(view.customer_name)}</div></div>
        <div class="box"><div class="label">Mekân</div><div class="value">${escapeHtml(view.venue_name ?? "-")}</div></div>
        <div class="box"><div class="label">Etkinlik Tarihi</div><div class="value">${escapeHtml(formatDate(view.event_date))}</div></div>
        <div class="box"><div class="label">Geçerlilik</div><div class="value">${escapeHtml(formatDate(view.valid_until))}</div></div>
      </div>
    </div>

    <div class="section">
      <h2>Program Akışı ve Hizmet İçeriği</h2>
      <table>
        <thead>
          <tr>
            <th>Başlangıç</th>
            <th>Bitiş</th>
            <th>Hizmet</th>
            <th class="right">Adet</th>
            <th class="right">Birim</th>
            <th class="right">Tutar</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>Teklif Özeti</h2>
      <div class="summaries">${summariesHtml}</div>
      <div class="muted" style="margin-top: 10px;">
        Fatura durumu: ${escapeHtml(getOptionLabel(invoiceTypeOptions, view.invoice_type))}
        ${view.invoice_type === "with_invoice" ? ` • KDV oranı: %${escapeHtml(String(view.vat_rate))}` : ""}
      </div>
    </div>

    <div class="section">
      <h2>Ödeme Bilgisi</h2>
      <div class="box">
        <div class="row"><span>Ön ödeme</span><strong>${escapeHtml(formatMoney(view.advance_payment_amount, view.advance_payment_currency))}</strong></div>
        ${view.payment_terms ? `<div class="note" style="margin-top: 10px;">${escapeHtml(view.payment_terms)}</div>` : ""}
      </div>
    </div>

    ${
      view.customer_visible_notes
        ? `<div class="section"><h2>Notlar</h2><div class="note">${escapeHtml(view.customer_visible_notes)}</div></div>`
        : ""
    }

    <div class="signature">
      <div class="sign-box">VIA EVENTS Yetkilisi</div>
      <div class="sign-box">Müşteri Onayı</div>
    </div>
  </div>

  <script>
    window.focus();
    window.print();
  </script>
</body>
</html>`;

  windowRef.document.open();
  windowRef.document.write(html);
  windowRef.document.close();
}
