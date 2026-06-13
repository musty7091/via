import type {
  AgreementCustomerMap,
  AgreementDetail,
  AgreementVenueMap,
} from "../types/agreementTypes";
import { formatDate, formatMoney, formatTime } from "../../offers/components/formatters";
import {
  getOptionLabel,
  invoiceTypeOptions,
  programSectionOptions,
} from "../../offers/constants/offerConstants";

type AgreementDetailPanelProps = {
  detail: AgreementDetail;
  customerMap: AgreementCustomerMap;
  venueMap: AgreementVenueMap;
  onPrint: () => void;
  onOpenEventFile: (eventId: number) => void;
};

export function AgreementDetailPanel({
  detail,
  customerMap,
  venueMap,
  onPrint,
  onOpenEventFile,
}: AgreementDetailPanelProps) {
  const agreement = detail.offer;
  const customer = customerMap[agreement.customer_id];
  const venue = agreement.venue_id ? venueMap[agreement.venue_id] : null;

  const remainingPaymentAmount =
    agreement.advance_payment_currency === agreement.currency
      ? Math.max(agreement.total_amount - agreement.advance_payment_amount, 0)
      : agreement.total_amount;

  const sortedItems = [...detail.items].sort(
    (firstItem, secondItem) => firstItem.sort_order - secondItem.sort_order
  );

  return (
    <section className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-300">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                {agreement.offer_no ?? `ANLAŞMA-${agreement.id}`}
              </p>

              <h2 className="mt-3 truncate text-3xl font-black tracking-tight">
                {agreement.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {customer?.name ?? `Müşteri #${agreement.customer_id}`}
                {venue ? ` • ${venue.name}` : ""}
              </p>
            </div>

            <span className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950">
              Anlaşma
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <InfoPill title="Teklif no" value={agreement.offer_no ?? "-"} />
            <InfoPill
              title="Etkinlik tarihi"
              value={formatDate(agreement.event_date)}
            />
            <InfoPill
              title="Fatura tipi"
              value={getOptionLabel(invoiceTypeOptions, agreement.invoice_type)}
            />
            <InfoPill title="Etkinlik ID" value={`${agreement.event_id ?? "-"}`} />
            <InfoPill title="Kalem sayısı" value={`${detail.items.length}`} />
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPrint}
              className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            >
              Anlaşma Çıktısı / PDF
            </button>

            <button
              type="button"
              disabled={!agreement.event_id}
              onClick={() => {
                if (agreement.event_id) {
                  onOpenEventFile(agreement.event_id);
                }
              }}
              className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Etkinlik Dosyasına Git
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          title="Ara toplam"
          value={formatMoney(agreement.amount, agreement.currency)}
        />
        <Metric
          title="KDV"
          value={formatMoney(agreement.vat_amount, agreement.currency)}
        />
        <Metric
          title="Genel toplam"
          value={formatMoney(agreement.total_amount, agreement.currency)}
          strong
        />
        <Metric
          title="Ön ödeme"
          value={formatMoney(
            agreement.advance_payment_amount,
            agreement.advance_payment_currency
          )}
        />
        <Metric
          title="Kalan ödeme"
          value={formatMoney(remainingPaymentAmount, agreement.currency)}
          strong
        />
      </section>

      {agreement.agreement_notes ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
            Anlaşma Notu
          </p>
          <p className="mt-2 text-sm leading-6 text-emerald-950">
            {agreement.agreement_notes}
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
            Anlaşma İçeriği
          </p>
          <h3 className="mt-2 text-xl font-black text-slate-950">
            Anlaşma Kalemleri
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Bu kalemler tekliften anlaşmaya taşınan müşteri ve operasyon
            içeriğidir.
          </p>
        </div>

        {sortedItems.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Bu anlaşmada henüz kalem bulunmuyor.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            <div className="hidden grid-cols-[56px_minmax(0,1fr)_70px_110px_110px] gap-3 bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 xl:grid">
              <span>Sıra</span>
              <span>Kalem</span>
              <span>Adet</span>
              <span>Satış</span>
              <span>Maliyet</span>
            </div>

            <div className="divide-y divide-slate-100">
              {sortedItems.map((item, index) => {
                const isPackageComponent =
                  item.source_type === "package_component";

                return (
                  <article
                    key={item.id}
                    className="grid gap-3 p-4 xl:grid-cols-[56px_minmax(0,1fr)_70px_110px_110px] xl:items-start"
                  >
                    <div className="text-sm font-black text-emerald-700">
                      {item.sort_order || index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-950">
                          {item.title}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            item.is_visible_on_offer
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.is_visible_on_offer
                            ? "Müşteri kalemi"
                            : "İç kalem"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {getOptionLabel(
                          programSectionOptions,
                          item.program_section
                        )}
                        {item.start_time || item.end_time ? (
                          <>
                            {" "}
                            • {formatTime(item.start_time)} -{" "}
                            {formatTime(item.end_time)}
                          </>
                        ) : null}
                      </p>

                      {item.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    <Amount title="Adet" value={`${item.quantity}`} />

                    <Amount
                      title="Satış"
                      value={
                        isPackageComponent
                          ? "Paket içinde"
                          : formatMoney(item.base_amount, item.currency)
                      }
                    />

                    <Amount
                      title="Maliyet"
                      value={formatMoney(
                        item.internal_total_cost,
                        item.internal_cost_currency
                      )}
                    />
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-700">
          Sadece Backoffice
        </p>
        <h3 className="mt-2 text-xl font-black text-amber-950">
          İç Kârlılık Özeti
        </h3>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          Bu bölüm müşteriye gitmez. Anlaşmanın gelir, maliyet ve brüt kâr
          kontrolü içindir.
        </p>

        {detail.internal_summaries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-amber-900">
            İç kârlılık özeti henüz oluşmadı.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.internal_summaries.map((summary) => (
              <article
                key={summary.currency}
                className="rounded-3xl bg-white p-4"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
                  {summary.currency}
                </p>

                <div className="mt-3 grid gap-2 text-sm">
                  <Row
                    label="Gelir"
                    value={formatMoney(summary.revenue_amount, summary.currency)}
                  />
                  <Row
                    label="Maliyet"
                    value={formatMoney(summary.cost_amount, summary.currency)}
                  />
                  <Row
                    label="Brüt kâr"
                    value={formatMoney(
                      summary.gross_profit_amount,
                      summary.currency
                    )}
                    strong
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function InfoPill({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </article>
  );
}

function Metric({
  title,
  value,
  strong,
}: {
  title: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border bg-white p-4 shadow-sm ${
        strong ? "border-emerald-200" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p
        className={`mt-3 text-xl font-black ${
          strong ? "text-emerald-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          strong ? "font-black text-slate-950" : "font-bold text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Amount({ title, value }: { title: string; value: string }) {
  return (
    <div className="text-sm font-bold text-slate-700">
      <span className="xl:hidden">{title}: </span>
      <span className="text-slate-950">{value}</span>
    </div>
  );
}