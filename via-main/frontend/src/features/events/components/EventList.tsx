import { eventStatusOptions, getOptionLabel } from "../constants/eventConstants";
import type { CustomerOption, EventListItem, VenueOption } from "../types/eventTypes";
import { formatDate, formatMoney } from "./formatters";

type EventListProps = {
  events: EventListItem[];
  customers: CustomerOption[];
  venues: VenueOption[];
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
};

export function EventList({
  events,
  customers,
  venues,
  selectedEventId,
  onSelectEvent,
}: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-black text-slate-700">Etkinlik bulunamadı.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Teklif anlaşmaya çevrildiğinde burada otomatik etkinlik dosyası oluşur.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {events.map((event) => {
        const isSelected = selectedEventId === event.id;
        const customerName =
          customers.find((customer) => customer.id === event.customer_id)?.name ??
          `Müşteri #${event.customer_id}`;
        const venueName =
          venues.find((venue) => venue.id === event.venue_id)?.name ??
          (event.venue_id ? `Mekân #${event.venue_id}` : "Mekân yok");

        return (
          <button
            key={event.id}
            onClick={() => onSelectEvent(event.id)}
            className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
              isSelected ? "bg-teal-50" : "bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {event.title}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(event.event_date)} • {customerName}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  event.status === "planned"
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {getOptionLabel(eventStatusOptions, event.status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {event.event_code ?? `EVT-${event.id}`}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {venueName}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                {formatMoney(event.total_customer_amount, event.agreement_currency)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
