import {
  getOptionLabel,
  invoiceTypeOptions,
  offerStatusOptions,
  programSectionOptions,
} from "../constants/offerConstants";
import type { OfferDetail } from "../types/offerTypes";
import { formatDate, formatMoney, formatTime } from "./formatters";

type OfferDetailPanelProps = {
  detail: OfferDetail;
  onOpenItemForm: () => void;
  onRemoveItem: (itemId: number) => void;
  onPrint: () => void;
  onConvertToAgreement: () => void;
  removingItemId: number | null;
  isConverting: boolean;
};

export function OfferDetailPanel({
  detail,
  onOpenItemForm,
  onRemoveItem,
  onPrint,
  onConvertToAgreement,
  removingItemId,
  isConverting,
}: OfferDetailPanelProps) {
  const offer = detail.offer;

  return (
    <section className="space-y-4">
      <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
          {offer.offer_no ?? "Teklif"}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-black">{offer.title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Etkinlik: {formatDate(offer.event_date)} • Geçerlilik: {formatDate(offer.valid_until)}
            </p>
          </div>
          <span className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950">
            {getOptionLabel(offerStatusOptions, offer.status)}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onPrint}
            className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950"
          >
            Müşteri Print / PDF
          </button>
          <button
            onClick={onConvertToAgreement}
            disabled={offer.status === "agreement" || isConverting}
            className="rounded-full bg-teal-300 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {offer.status === "agreement"
              ? "Anlaşmaya Çevrildi"
              : isConverting
                ? "Çevriliyor..."
                : "Anlaşmaya Çevir"}
          </button>
          <button
            onClick={onOpenItemForm}
            className="rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white"
          >
            Manuel Kalem Ekle
          </button>
        </div>
      </section>

      {offer.event_id ? (
        <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
          <p className="text-sm font-black text-teal-900">
            Etkinlik dosyası oluşturuldu.
          </p>
          <p className="mt-2 text-sm leading-6 text-teal-900">
            Bu anlaşma artık gerçek bir etkinlik dosyasına bağlı. Operasyon,
            ödeme, gider ve kârlılık takibi bundan sonra etkinlik üzerinden
            yürütülecek.
          </p>
          <p className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-black text-teal-800 inline-flex">
            Etkinlik ID: {offer.event_id}
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <Metric title="Fatura Tipi" value={getOptionLabel(invoiceTypeOptions, offer.invoice_type)} />
        <Metric title="Ön Ödeme" value={formatMoney(offer.advance_payment_amount, offer.advance_payment_currency)} />
        <Metric title="Ana Toplam" value={formatMoney(offer.total_amount, offer.currency)} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">
          Müşteriye Görünecek Teklif Özeti
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Bu bölüm print çıktısına gider. İç maliyetler burada gösterilmez.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {detail.visible_summaries.map((summary) => (
            <article key={summary.currency} className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                {summary.currency}
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <Row label="Ara toplam" value={formatMoney(summary.visible_amount, summary.currency)} />
                <Row label="KDV" value={formatMoney(summary.vat_amount, summary.currency)} />
                <Row label="Genel toplam" value={formatMoney(summary.total_amount, summary.currency)} strong />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h3 className="text-lg font-black text-amber-950">
          İç Kârlılık Özeti
        </h3>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          Bu bölüm sadece Back Office içindir. Print çıktısına ve müşteriye gitmez.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {detail.internal_summaries.map((summary) => (
            <article key={summary.currency} className="rounded-3xl bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                {summary.currency}
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <Row label="Gelir" value={formatMoney(summary.revenue_amount, summary.currency)} />
                <Row label="Maliyet" value={formatMoney(summary.cost_amount, summary.currency)} />
                <Row label="Brüt kâr" value={formatMoney(summary.gross_profit_amount, summary.currency)} strong />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">
          Teklif Satırları
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Görünür olan satırlar müşteriye gider. İç maliyet sütunları sadece burada görünür.
        </p>

        {detail.items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz teklif satırı yok.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            {detail.items.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 xl:grid-cols-[90px_1fr_135px_135px_135px_90px]"
              >
                <div className="text-sm font-black text-teal-700">
                  {formatTime(item.start_time)}
                  <br />
                  <span className="text-xs text-slate-400">
                    {formatTime(item.end_time)}
                  </span>
                </div>

                <div>
                  <p className="font-black text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {getOptionLabel(programSectionOptions, item.program_section)}
                    {item.is_visible_on_offer ? " • Teklifte görünür" : " • İç kalem"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </div>

                <Amount title="Satış" value={formatMoney(item.base_amount, item.currency)} />
                <Amount title="Maliyet" value={formatMoney(item.internal_total_cost, item.internal_cost_currency)} />
                <Amount
                  title="Kâr"
                  value={
                    item.currency === item.internal_cost_currency
                      ? formatMoney(item.internal_profit, item.currency)
                      : "Kur gerekli"
                  }
                />

                <div className="flex items-start xl:justify-end">
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    disabled={removingItemId === item.id}
                    className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {removingItemId === item.id ? "..." : "Kaldır"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p className="mt-3 text-xl font-black text-slate-950">{value}</p>
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
