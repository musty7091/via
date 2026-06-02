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
    <section className="rounded-3xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-lg font-black text-slate-950">Mekânlar</h3>
        <p className="mt-1 text-sm text-slate-500">
          Müşteriye bağlı salon, açık alan ve etkinlik mekânları.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {venues.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz mekân eklenmemiş.
          </p>
        ) : (
          venues.map((venue) => (
            <article
              key={venue.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <p className="font-black text-slate-950">{venue.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {getOptionLabel(venueTypeOptions, venue.venue_type)}
                {venue.city ? ` • ${venue.city}` : ""}
                {venue.district ? ` / ${venue.district}` : ""}
              </p>

              <div className="mt-3 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                <span>Kapasite: {venue.capacity ?? "-"}</span>
                <span>Yetkili: {venue.contact_name ?? "-"}</span>
                <span>Telefon: {venue.contact_phone ?? "-"}</span>
              </div>
            </article>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-800">Yeni mekân ekle</p>

        <div className="mt-3 grid gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mekân adı"
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
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="Kapasite"
              type="number"
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
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isSaving ? "Ekleniyor..." : "Mekân Ekle"}
          </button>
        </div>
      </form>
    </section>
  );
}