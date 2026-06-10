import { FormEvent, useState } from "react";

import {
  currencyOptions,
  customerStatusOptions,
  customerTypeOptions,
  invoiceTypeOptions,
  riskLevelOptions,
} from "../constants/customerConstants";
import type {
  CustomerCreatePayload,
  CustomerDetail,
} from "../types/customerTypes";

type CustomerFormProps = {
  onCreateCustomer?: (payload: CustomerCreatePayload) => Promise<void>;
  onSubmit?: (payload: CustomerCreatePayload) => Promise<void>;
  initialCustomer?: CustomerDetail | null;
  eyebrow?: string;
  title?: string;
  submitLabel?: string;
};

export function CustomerForm({
  onCreateCustomer,
  onSubmit,
  initialCustomer,
  eyebrow = "Yeni müşteri",
  title = "Müşteri kartı oluştur",
  submitLabel = "Müşteri Kaydet",
}: CustomerFormProps) {
  const [name, setName] = useState(initialCustomer?.name ?? "");
  const [shortName, setShortName] = useState(initialCustomer?.short_name ?? "");
  const [customerType, setCustomerType] = useState(
    initialCustomer?.customer_type ?? "company"
  );
  const [customerStatus, setCustomerStatus] = useState(
    initialCustomer?.customer_status ?? "active"
  );
  const [phone, setPhone] = useState(initialCustomer?.phone ?? "");
  const [email, setEmail] = useState(initialCustomer?.email ?? "");
  const [taxNumber, setTaxNumber] = useState(
    initialCustomer?.tax_number ?? ""
  );
  const [taxOffice, setTaxOffice] = useState(
    initialCustomer?.tax_office ?? ""
  );
  const [city, setCity] = useState(initialCustomer?.city ?? "");
  const [district, setDistrict] = useState(initialCustomer?.district ?? "");
  const [address, setAddress] = useState(initialCustomer?.address ?? "");
  const [defaultInvoiceType, setDefaultInvoiceType] = useState(
    initialCustomer?.default_invoice_type ?? "select_on_event"
  );
  const [defaultCurrency, setDefaultCurrency] = useState(
    initialCustomer?.default_currency ?? "TRY"
  );
  const [riskLevel, setRiskLevel] = useState(
    initialCustomer?.risk_level ?? "normal"
  );
  const [notes, setNotes] = useState(initialCustomer?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    const submitHandler = onSubmit ?? onCreateCustomer;

    if (!submitHandler) {
      return;
    }

    setIsSaving(true);

    try {
      await submitHandler({
        customer_type: customerType,
        customer_status: customerStatus,
        name: name.trim(),
        short_name: shortName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        tax_number: taxNumber.trim() || null,
        tax_office: taxOffice.trim() || null,
        website: initialCustomer?.website ?? null,
        country: initialCustomer?.country ?? "KKTC",
        city: city.trim() || null,
        district: district.trim() || null,
        address: address.trim() || null,
        default_invoice_type: defaultInvoiceType,
        default_currency: defaultCurrency,
        default_payment_term_days:
          initialCustomer?.default_payment_term_days ?? null,
        risk_level: riskLevel,
        risk_note: initialCustomer?.risk_note ?? null,
        is_active: initialCustomer?.is_active ?? true,
        notes: notes.trim() || null,
      });

      if (!initialCustomer) {
        setName("");
        setShortName("");
        setPhone("");
        setEmail("");
        setTaxNumber("");
        setTaxOffice("");
        setCity("");
        setDistrict("");
        setAddress("");
        setNotes("");
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-black text-slate-950">{title}</h3>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-sm font-bold text-slate-700">
            Müşteri adı / ünvan
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            placeholder="Örn: Merit Hotel"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-slate-700">Kısa ad</span>
          <input
            value={shortName}
            onChange={(event) => setShortName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            placeholder="Örn: Merit"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              Müşteri tipi
            </span>
            <select
              value={customerType}
              onChange={(event) => setCustomerType(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            >
              {customerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Durum</span>
            <select
              value={customerStatus}
              onChange={(event) => setCustomerStatus(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            >
              {customerStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Telefon</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">E-posta</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Vergi no</span>
            <input
              value={taxNumber}
              onChange={(event) => setTaxNumber(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              Vergi dairesi
            </span>
            <input
              value={taxOffice}
              onChange={(event) => setTaxOffice(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">Şehir</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Bölge</span>
            <input
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-slate-700">Adres</span>
          <textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              Fatura tercihi
            </span>
            <select
              value={defaultInvoiceType}
              onChange={(event) => setDefaultInvoiceType(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            >
              {invoiceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">
              Para birimi
            </span>
            <select
              value={defaultCurrency}
              onChange={(event) => setDefaultCurrency(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">Risk</span>
            <select
              value={riskLevel}
              onChange={(event) => setRiskLevel(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
            >
              {riskLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-slate-700">Not</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
          />
        </label>

        <button
          type="submit"
          disabled={isSaving}
          className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {isSaving ? "Kaydediliyor..." : submitLabel}
        </button>
      </div>
    </form>
  );
}