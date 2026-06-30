import { useState } from "react";

import {
  eventStatusOptions,
  getOptionLabel,
  invoiceTypeOptions,
} from "../constants/eventConstants";
import { updateEventStatus } from "../api/eventsApi";
import type {
  CustomerOption,
  EventCurrencySummary,
  EventDetail,
  VenueOption,
} from "../types/eventTypes";
import { compactText, formatDate, formatMoney } from "./formatters";
import { EventPaymentsPanel } from "./EventPaymentsPanel";

type EventDetailPanelProps = {
  detail: EventDetail;
  customers: CustomerOption[];
  venues: VenueOption[];
  onStatusChanged?: () => void;
  readOnly?: boolean;
};

export function EventDetailPanel({
  detail,
  customers,
  venues,
  onStatusChanged,
  readOnly = false,
}: EventDetailPanelProps) {
  const event = detail.event;
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function handleStatusChange(nextStatus: string) {
    if (nextStatus === event.status) {
      return;
    }
    setStatusSaving(true);
    setStatusError(null);
    try {
      await updateEventStatus(event.id, nextStatus);
      onStatusChanged?.();
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Durum güncellenemedi."
      );
    } finally {
      setStatusSaving(false);
    }
  }

  const customerName =
    customers.find((customer) => customer.id === event.customer_id)?.name ??
    `Müşteri #${event.customer_id}`;
  const venueName =
    venues.find((venue) => venue.id === event.venue_id)?.name ??
    (event.venue_id ? `Mekân #${event.venue_id}` : "Mekân belirtilmedi");

  const summaries = buildCurrencySummaries(detail);

  return (
    <section className="space-y-4">
      <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
          {event.event_code ?? `EVT-${event.id}`}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black">{event.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {customerName} • {venueName} • {formatDate(event.event_date)}
            </p>
          </div>
          <span className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950">
            {getOptionLabel(eventStatusOptions, event.status)}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <DarkMetric
            title="Anlaşma Tutarı"
            value={formatMoney(event.total_customer_amount, event.agreement_currency)}
          />
          <DarkMetric
            title="Fatura Tipi"
            value={getOptionLabel(invoiceTypeOptions, event.invoice_type)}
          />
          <DarkMetric
            title="Dönem Durumu"
            value={event.is_period_closed ? "Kapalı" : "Açık"}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">Etkinlik Durumu</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Operasyonel durumdur; finansal kapanıştan bağımsızdır. Etkinlik
              gerçekleştiğinde <strong>Tamamlandı</strong> olarak işaretle.
            </p>
          </div>
          {readOnly ? (
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
              {getOptionLabel(eventStatusOptions, event.status)}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={event.status}
                disabled={statusSaving}
                onChange={(e) => void handleStatusChange(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
              >
                {eventStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {event.status !== "completed" ? (
                <button
                  type="button"
                  disabled={statusSaving}
                  onClick={() => void handleStatusChange("completed")}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                  Tamamlandı işaretle
                </button>
              ) : null}
            </div>
          )}
        </div>
        {statusSaving ? (
          <p className="mt-2 text-xs font-bold text-slate-400">Kaydediliyor...</p>
        ) : null}
        {statusError ? (
          <p className="mt-2 text-xs font-bold text-rose-600">{statusError}</p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
        <h3 className="text-lg font-black text-teal-950">
          Etkinlik dosyası aktif.
        </h3>
        <p className="mt-1 text-sm leading-6 text-teal-900">
          Bu dosya artık operasyon, tahsilat, gider, rider kontrolü ve kârlılık
          takibinin merkezi olacak.
        </p>
      </section>

      <EventPaymentsPanel event={event} />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">
          Para Birimi Bazlı İç Özet
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Gelir, maliyet ve brüt kâr ayrı para birimlerinde ayrı takip edilir.
        </p>

        {summaries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz etkinlik kalemi yok.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {summaries.map((summary) => (
              <article
                key={summary.currency}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                  {summary.currency}
                </p>
                <div className="mt-3 grid gap-2 text-sm">
                  <Row label="Gelir" value={formatMoney(summary.revenueAmount, summary.currency)} />
                  <Row label="Maliyet" value={formatMoney(summary.costAmount, summary.currency)} />
                  <Row label="Brüt kâr" value={formatMoney(summary.grossProfitAmount, summary.currency)} strong />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">
          Etkinlik Kalemleri
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Tekliften gelen snapshot kalemler. Sonraki adımlarda operasyon ve gider
          bu kalemlere bağlanacak.
        </p>

        {detail.items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz etkinlik kalemi yok.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            {detail.items.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 xl:grid-cols-[1fr_135px_135px_135px]"
              >
                <div>
                  <p className="font-black text-slate-950">
                    {compactText(item.description)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.item_type}
                  </p>
                </div>

                <Amount
                  title="Satış"
                  value={formatMoney(item.sale_amount, item.sale_currency)}
                />
                <Amount
                  title="Maliyet"
                  value={formatMoney(item.cost_amount, item.cost_currency)}
                />
                <Amount
                  title="Kâr"
                  value={
                    item.sale_currency === item.cost_currency
                      ? formatMoney(
                          item.sale_amount - item.cost_amount,
                          item.sale_currency
                        )
                      : "Kur gerekli"
                  }
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function buildCurrencySummaries(detail: EventDetail): EventCurrencySummary[] {
  const map = new Map<string, EventCurrencySummary>();

  detail.items.forEach((item) => {
    if (item.sale_currency === item.cost_currency) {
      const current =
        map.get(item.sale_currency) ??
        {
          currency: item.sale_currency,
          revenueAmount: 0,
          costAmount: 0,
          grossProfitAmount: 0,
        };

      current.revenueAmount += item.sale_amount;
      current.costAmount += item.cost_amount;
      current.grossProfitAmount += item.sale_amount - item.cost_amount;
      map.set(item.sale_currency, current);
      return;
    }

    const saleSummary =
      map.get(item.sale_currency) ??
      {
        currency: item.sale_currency,
        revenueAmount: 0,
        costAmount: 0,
        grossProfitAmount: 0,
      };
    saleSummary.revenueAmount += item.sale_amount;
    saleSummary.grossProfitAmount += item.sale_amount;
    map.set(item.sale_currency, saleSummary);

    const costSummary =
      map.get(item.cost_currency) ??
      {
        currency: item.cost_currency,
        revenueAmount: 0,
        costAmount: 0,
        grossProfitAmount: 0,
      };
    costSummary.costAmount += item.cost_amount;
    costSummary.grossProfitAmount -= item.cost_amount;
    map.set(item.cost_currency, costSummary);
  });

  return Array.from(map.values()).map((summary) => ({
    ...summary,
    revenueAmount: roundMoney(summary.revenueAmount),
    costAmount: roundMoney(summary.costAmount),
    grossProfitAmount: roundMoney(summary.grossProfitAmount),
  }));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function DarkMetric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl bg-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-black text-slate-950" : "font-bold text-slate-700"}>
        {value}
      </span>
    </div>
  );
}

function Amount({ title, value }: { title: string; value: string }) {
  return (
    <div className="text-sm font-bold text-slate-700">
      {title}
      <br />
      <span className="text-slate-950">{value}</span>
    </div>
  );
}
