import { FormEvent, useState } from "react";

import { getOptionLabel, venueTypeOptions } from "../constants/customerConstants";
import type {
  CustomerVenue,
  CustomerVenueCreatePayload,
} from "../types/customerTypes";

type CustomerVenueListProps = {
  venues: CustomerVenue[];
  onCreateVenue: (payload: CustomerVenueCreatePayload) => Promise<void>;
};

export function CustomerVenueList({
  venues,
  onCreateVenue,
}: CustomerVenueListProps) {
  const [name, setName] = useState("");
  const [venueType, setVenueType] = useState("hotel");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [capacity, setCapacity] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onCreateVenue({
        name: name.trim(),
        venue_type: venueType,
        country: "KKTC",
        city: city.trim() || null,
        district: district.trim() || null,
        capacity: capacity ? Number(capacity) : null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        is_active: true,
      });

      setName("");
      setCity("");
      setDistrict("");
      setCapacity("");
      setContactName("");
      setContactPhone("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-slate-950">Mekân Bilgileri</h3>
          <p className="mt-1 text-sm text-slate-500">
            Müşteriye ait operasyon yapılacak alanlar.
          </p>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mekân / Salon Adı"
            required
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={venueType}
              onChange={(event) => setVenueType(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              {venueTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="Kapasite (Kişi)"
              min="1"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Şehir"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder="Bölge"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Mekân yetkilisi"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              placeholder="Yetkili telefon"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Ekleniyor..." : "Mekân Ekle"}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {venues.length === 0 ? (
            <div className="bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
              Kayıtlı mekân yok.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {venues.map((venue) => (
                <div key={venue.id} className="bg-white p-4">
                  <p className="text-sm font-medium text-slate-950">
                    {venue.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {getOptionLabel(venueTypeOptions, venue.venue_type)}
                    {venue.capacity ? ` • ${venue.capacity} Kişi` : ""}
                    {venue.city ? ` • ${venue.city}` : ""}
                  </p>

                  {venue.contact_name || venue.contact_phone ? (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
                      <p>
                        Yetkili: <span className="font-medium">{venue.contact_name ?? "-"}</span>
                      </p>
                      <p className="mt-1">
                        Telefon: <span className="font-medium">{venue.contact_phone ?? "-"}</span>
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}