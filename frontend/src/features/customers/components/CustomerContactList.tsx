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
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-slate-950">Yetkili Kişiler</h3>
          <p className="mt-1 text-sm text-slate-500">
            Operasyon, finans ve yönetim bağlantıları.
          </p>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ad Soyad"
            required
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ünvan (Örn: Müdür)"
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
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "Ekleniyor..." : "Yetkili Ekle"}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          {contacts.length === 0 ? (
            <div className="bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
              Kayıtlı kişi yok.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-white p-4">
                  <p className="text-sm font-medium text-slate-950">
                    {contact.full_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {getOptionLabel(contactRoleOptions, contact.contact_role)}
                    {contact.title ? ` • ${contact.title}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {contact.phone ? (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {contact.phone}
                      </span>
                    ) : null}

                    {contact.email ? (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {contact.email}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}