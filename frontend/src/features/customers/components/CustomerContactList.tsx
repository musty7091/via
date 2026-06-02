import { FormEvent, useState } from "react";

import {
  contactRoleOptions,
  getOptionLabel,
} from "../constants/customerConstants";
import type {
  CustomerContact,
  CustomerContactCreatePayload,
} from "../types/customerTypes";

type CustomerContactListProps = {
  contacts: CustomerContact[];
  onCreateContact: (payload: CustomerContactCreatePayload) => Promise<void>;
};

export function CustomerContactList({
  contacts,
  onCreateContact,
}: CustomerContactListProps) {
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [contactRole, setContactRole] = useState("event_responsible");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!fullName.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onCreateContact({
        full_name: fullName.trim(),
        title: title.trim() || null,
        contact_role: contactRole,
        phone: phone.trim() || null,
        whatsapp_phone: phone.trim() || null,
        email: email.trim() || null,
        is_primary_contact: contacts.length === 0,
        is_accounting_contact: contactRole === "accounting",
        is_operation_contact:
          contactRole === "operation" || contactRole === "event_responsible",
        is_active: true,
      });

      setFullName("");
      setTitle("");
      setPhone("");
      setEmail("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            Yetkili Kişiler
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Teklif, tahsilat ve operasyon görüşmeleri için.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {contacts.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz yetkili kişi eklenmemiş.
          </p>
        ) : (
          contacts.map((contact) => (
            <article
              key={contact.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-black text-slate-950">
                    {contact.full_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {contact.title ?? "-"} •{" "}
                    {getOptionLabel(contactRoleOptions, contact.contact_role)}
                  </p>
                </div>

                {contact.is_primary_contact ? (
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
                    Ana yetkili
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                <span>{contact.phone ?? "Telefon yok"}</span>
                <span>{contact.email ?? "E-posta yok"}</span>
              </div>
            </article>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-800">Yeni yetkili ekle</p>

        <div className="mt-3 grid gap-3">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ad soyad"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Görev / Ünvan"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <select
              value={contactRole}
              onChange={(event) => setContactRole(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              {contactRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Telefon / WhatsApp"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="E-posta"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isSaving ? "Ekleniyor..." : "Yetkili Ekle"}
          </button>
        </div>
      </form>
    </section>
  );
}