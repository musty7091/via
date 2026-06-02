import { FormEvent, useState } from "react";

import {
  currencyOptions,
  invoiceTypeOptions,
  programSectionOptions,
} from "../constants/offerConstants";
import type {
  Currency,
  CustomerOption,
  InvoiceType,
  OfferCreatePayload,
  OfferItemCreatePayload,
  PackageOption,
  VenueOption,
} from "../types/offerTypes";

type ModalShellProps = {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function ModalShell({ title, eyebrow, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function OfferForm({
  customers,
  venues,
  packages,
  onCustomerChange,
  onSubmit,
  onDone,
}: {
  customers: CustomerOption[];
  venues: VenueOption[];
  packages: PackageOption[];
  onCustomerChange: (customerId: number | null) => void;
  onSubmit: (payload: OfferCreatePayload, packageId: number | null) => Promise<void>;
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [title, setTitle] = useState("Etkinlik Program Teklifi");
  const [eventDate, setEventDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("without_invoice");
  const [vatRate, setVatRate] = useState("16");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState("0");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [customerVisibleNotes, setCustomerVisibleNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedCustomerId = Number(customerId);
    if (!selectedCustomerId) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(
        {
          customer_id: selectedCustomerId,
          venue_id: Number(venueId) || null,
          package_id: Number(packageId) || null,
          title: title.trim(),
          offer_date: null,
          event_date: eventDate || null,
          valid_until: validUntil || null,
          invoice_type: invoiceType,
          vat_rate: Number(vatRate || 0),
          currency,
          advance_payment_amount: Number(advancePaymentAmount || 0),
          advance_payment_currency: currency,
          payment_terms: paymentTerms.trim() || null,
          customer_visible_notes: customerVisibleNotes.trim() || null,
          internal_notes: internalNotes.trim() || null,
        },
        Number(packageId) || null
      );
      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <SelectField
        label="Müşteri"
        value={customerId}
        onChange={(value) => {
          setCustomerId(value);
          setVenueId("");
          onCustomerChange(Number(value) || null);
        }}
        options={[
          { value: "", label: "Müşteri seçiniz" },
          ...customers.map((customer) => ({
            value: String(customer.id),
            label: customer.name,
          })),
        ]}
      />

      <SelectField
        label="Mekân"
        value={venueId}
        onChange={setVenueId}
        options={[
          { value: "", label: "Mekân seçiniz" },
          ...venues.map((venue) => ({
            value: String(venue.id),
            label: venue.name,
          })),
        ]}
      />

      <SelectField
        label="Program paketi"
        value={packageId}
        onChange={setPackageId}
        options={[
          { value: "", label: "Paket seçmeden devam et" },
          ...packages.map((item) => ({
            value: String(item.id),
            label: item.name,
          })),
        ]}
      />

      <TextField label="Teklif başlığı" value={title} onChange={setTitle} required />

      <div className="grid gap-3 md:grid-cols-2">
        <DateField label="Etkinlik tarihi" value={eventDate} onChange={setEventDate} />
        <DateField label="Teklif geçerlilik tarihi" value={validUntil} onChange={setValidUntil} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="Fatura tipi"
          value={invoiceType}
          onChange={(value) => setInvoiceType(value as InvoiceType)}
          options={invoiceTypeOptions}
        />
        <NumberField label="KDV oranı" value={vatRate} onChange={setVatRate} />
        <SelectField
          label="Ana para birimi"
          value={currency}
          onChange={(value) => setCurrency(value as Currency)}
          options={currencyOptions as unknown as Array<{ value: string; label: string }>}
        />
      </div>

      <NumberField
        label="Ön ödeme"
        value={advancePaymentAmount}
        onChange={setAdvancePaymentAmount}
      />

      <TextareaField
        label="Ödeme şartları"
        value={paymentTerms}
        onChange={setPaymentTerms}
      />

      <TextareaField
        label="Müşteriye görünecek not"
        value={customerVisibleNotes}
        onChange={setCustomerVisibleNotes}
      />

      <TextareaField
        label="İç not (müşteriye görünmez)"
        value={internalNotes}
        onChange={setInternalNotes}
      />

      <SubmitButton isSaving={isSaving} label="Teklifi Oluştur" />
    </form>
  );
}

export function OfferItemForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (payload: OfferItemCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [programSection, setProgramSection] = useState("other");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [internalCost, setInternalCost] = useState("0");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [isVisibleOnOffer, setIsVisibleOnOffer] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || title.trim(),
        program_section: programSection,
        start_time: startTime ? `${startTime}:00` : null,
        end_time: endTime ? `${endTime}:00` : null,
        quantity: Number(quantity || 1),
        unit_price: Number(unitPrice || 0),
        currency,
        internal_unit_cost: Number(internalCost || 0),
        internal_cost_currency: currency,
        is_visible_on_offer: isVisibleOnOffer,
        sort_order: Number(sortOrder || 0),
      });
      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <TextField label="Kalem başlığı" value={title} onChange={setTitle} required />
      <TextareaField label="Açıklama" value={description} onChange={setDescription} />

      <div className="grid gap-3 md:grid-cols-3">
        <SelectField
          label="Program bölümü"
          value={programSection}
          onChange={setProgramSection}
          options={programSectionOptions}
        />
        <TextField label="Başlangıç" value={startTime} onChange={setStartTime} />
        <TextField label="Bitiş" value={endTime} onChange={setEndTime} />
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <NumberField label="Sıra" value={sortOrder} onChange={setSortOrder} />
        <NumberField label="Adet" value={quantity} onChange={setQuantity} />
        <NumberField label="Satış fiyatı" value={unitPrice} onChange={setUnitPrice} />
        <NumberField label="İç maliyet" value={internalCost} onChange={setInternalCost} />
        <SelectField
          label="Para birimi"
          value={currency}
          onChange={(value) => setCurrency(value as Currency)}
          options={currencyOptions as unknown as Array<{ value: string; label: string }>}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={isVisibleOnOffer}
          onChange={(event) => setIsVisibleOnOffer(event.target.checked)}
        />
        Müşteri teklifinde görünsün
      </label>

      <SubmitButton isSaving={isSaving} label="Kalemi Kaydet" />
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
      />
    </label>
  );
}

function SubmitButton({ isSaving, label }: { isSaving: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={isSaving}
      className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
    >
      {isSaving ? "Kaydediliyor..." : label}
    </button>
  );
}
