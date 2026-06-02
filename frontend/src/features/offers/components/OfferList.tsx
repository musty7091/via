import { getOptionLabel, offerStatusOptions } from "../constants/offerConstants";
import type { OfferListItem } from "../types/offerTypes";
import { formatDate, formatMoney } from "./formatters";

type OfferListProps = {
  offers: OfferListItem[];
  selectedOfferId: number | null;
  onSelectOffer: (offerId: number) => void;
};

export function OfferList({
  offers,
  selectedOfferId,
  onSelectOffer,
}: OfferListProps) {
  if (offers.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-black text-slate-700">Teklif bulunamadı.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Yeni teklif oluşturarak başlayabilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {offers.map((offer) => {
        const isSelected = selectedOfferId === offer.id;

        return (
          <button
            key={offer.id}
            onClick={() => onSelectOffer(offer.id)}
            className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
              isSelected ? "bg-teal-50" : "bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {offer.title}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {offer.offer_no ?? "Teklif no yok"} • {formatDate(offer.event_date)}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  offer.status === "agreement"
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {getOptionLabel(offerStatusOptions, offer.status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {formatMoney(offer.total_amount, offer.currency)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {offer.invoice_type === "with_invoice" ? "Faturalı" : "Faturasız"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
