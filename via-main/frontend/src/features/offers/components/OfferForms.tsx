import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import type {
  ArtistService,
  TechnicalService,
} from "../../serviceCatalog/types/serviceCatalogTypes";
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
  OfferListItem,
  PackageOption,
  VenueOption,
} from "../types/offerTypes";
import { formatMoney } from "./formatters";

type ModalShellProps = {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
};

const currencySelectOptions = currencyOptions.map((option) => ({
  value: option.value,
  label: option.label,
}));

export function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
          </div>

          <button
            type="button"
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
  initialOffer = null,
  submitLabel = "Teklifi Oluştur",
  onCustomerChange,
  onSubmit,
  onDone,
}: {
  customers: CustomerOption[];
  venues: VenueOption[];
  packages: PackageOption[];
  initialOffer?: OfferListItem | null;
  submitLabel?: string;
  onCustomerChange: (customerId: number | null) => void;
  onSubmit: (
    payload: OfferCreatePayload,
    packageId: number | null
  ) => Promise<void>;
  onDone: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [invoiceType, setInvoiceType] =
    useState<InvoiceType>("without_invoice");
  const [vatRate, setVatRate] = useState("0");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [customerVisibleNotes, setCustomerVisibleNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedCustomer =
    customers.find((customer) => String(customer.id) === customerId) ?? null;

  const selectedPackage =
    packages.find((item) => String(item.id) === packageId) ?? null;

  useEffect(() => {
    if (!initialOffer) {
      setCustomerId("");
      setVenueId("");
      setPackageId("");
      setTitle("");
      setEventDate("");
      setValidUntil("");
      setInvoiceType("without_invoice");
      setVatRate("0");
      setCurrency("TRY");
      setAdvancePaymentAmount("");
      setPaymentTerms("");
      setCustomerVisibleNotes("");
      setInternalNotes("");
      return;
    }

    setCustomerId(String(initialOffer.customer_id));
    setVenueId(initialOffer.venue_id ? String(initialOffer.venue_id) : "");
    setPackageId(
      initialOffer.package_id ? String(initialOffer.package_id) : ""
    );
    setTitle(initialOffer.title);
    setEventDate(initialOffer.event_date ?? "");
    setValidUntil(initialOffer.valid_until ?? "");
    setInvoiceType(initialOffer.invoice_type);
    setVatRate(String(initialOffer.vat_rate ?? 0));
    setCurrency(initialOffer.currency);
    setAdvancePaymentAmount(
      initialOffer.advance_payment_amount
        ? String(initialOffer.advance_payment_amount)
        : ""
    );
    setPaymentTerms(initialOffer.payment_terms ?? "");
    setCustomerVisibleNotes(initialOffer.customer_visible_notes ?? "");
    setInternalNotes(initialOffer.internal_notes ?? "");

    void onCustomerChange(initialOffer.customer_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOffer?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedCustomerId = Number(customerId);

    if (!selectedCustomerId || !title.trim()) {
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
    <form onSubmit={handleSubmit} className="grid gap-5">
      <FormSection
        eyebrow="1. Adım"
        title="Müşteri ve Mekan"
        description="Teklifin hangi müşteri ve hangi mekan için hazırlandığını belirleyin."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <SelectField
            label="Müşteri"
            value={customerId}
            required
            onChange={(value) => {
              const nextCustomer =
                customers.find((customer) => String(customer.id) === value) ??
                null;

              setCustomerId(value);
              setVenueId("");
              onCustomerChange(Number(value) || null);

              if (nextCustomer?.default_currency) {
                setCurrency(nextCustomer.default_currency);
              }
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
            label="Mekan"
            value={venueId}
            onChange={setVenueId}
            options={[
              { value: "", label: "Mekan seçmeden devam et" },
              ...venues.map((venue) => ({
                value: String(venue.id),
                label: venue.name,
              })),
            ]}
          />
        </div>

        {selectedCustomer ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-black text-slate-950">
              Seçili müşteri: {selectedCustomer.name}
            </p>
            <p className="mt-1">
              {selectedCustomer.city ?? "Şehir bilgisi yok"} •{" "}
              {selectedCustomer.phone ?? "Telefon yok"} • Varsayılan para
              birimi: {selectedCustomer.default_currency}
            </p>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        eyebrow="2. Adım"
        title="Paket ve Teklif Bilgileri"
        description="Program paketi seçebilir veya teklif oluşturduktan sonra katalogdan sanatçı / teknik hizmet ekleyebilirsiniz."
      >
        <SelectField
          label="Program paketi"
          value={packageId}
          onChange={(value) => {
            setPackageId(value);

            const nextPackage = packages.find(
              (item) => String(item.id) === value
            );

            if (nextPackage) {
              setCurrency(nextPackage.default_sale_currency);
            }
          }}
          options={[
            { value: "", label: "Paket seçmeden devam et" },
            ...packages.map((item) => ({
              value: String(item.id),
              label: item.name,
            })),
          ]}
        />

        {selectedPackage ? (
          <div className="rounded-3xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950">
            <p className="font-black">Seçili paket satış fiyatı</p>
            <p className="mt-1 leading-6">
              Paket içeriği teklife aktarılır. Müşteri toplamı, paket içindeki
              kalemlerden değil paket bedelinden hesaplanır:
              <span className="ml-2 font-black">
                {formatMoney(
                  selectedPackage.default_sale_amount,
                  selectedPackage.default_sale_currency
                )}
              </span>
            </p>
          </div>
        ) : null}

        <TextField
          label="Teklif başlığı"
          value={title}
          onChange={setTitle}
          placeholder="Örn: Frekans Konseri Program Teklifi"
          required
        />

        <div className="grid gap-3 md:grid-cols-2">
          <DateField
            label="Etkinlik tarihi"
            value={eventDate}
            onChange={setEventDate}
          />

          <DateField
            label="Teklif geçerlilik tarihi"
            value={validUntil}
            onChange={setValidUntil}
          />
        </div>
      </FormSection>

      <FormSection
        eyebrow="3. Adım"
        title="Finans ve Ödeme"
        description="Fatura tipi, KDV, para birimi ve ön ödeme bilgilerini belirleyin."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <SelectField
            label="Fatura tipi"
            value={invoiceType}
            onChange={(value) => setInvoiceType(value as InvoiceType)}
            options={invoiceTypeOptions}
          />

          <NumberField
            label="KDV oranı"
            value={vatRate}
            onChange={setVatRate}
            placeholder="0"
            min="0"
            step="0.01"
          />

          <SelectField
            label="Ana para birimi"
            value={currency}
            onChange={(value) => setCurrency(value as Currency)}
            options={currencySelectOptions}
          />
        </div>

        <MoneyField
          label="Ön ödeme"
          value={advancePaymentAmount}
          currency={currency}
          onChange={setAdvancePaymentAmount}
          placeholder="Ön ödeme yoksa boş bırak"
        />

        <TextareaField
          label="Ödeme şartları"
          value={paymentTerms}
          onChange={setPaymentTerms}
          placeholder="Örn: %50 ön ödeme, kalan tutar etkinlik günü tahsil edilir."
        />
      </FormSection>

      <FormSection
        eyebrow="4. Adım"
        title="Notlar"
        description="Müşteriye görünecek not ile sadece Backoffice içinde kalacak notu ayırın."
      >
        <TextareaField
          label="Müşteriye görünecek not"
          value={customerVisibleNotes}
          onChange={setCustomerVisibleNotes}
          placeholder="Bu not müşteri çıktısında görünür."
        />

        <TextareaField
          label="İç not"
          value={internalNotes}
          onChange={setInternalNotes}
          placeholder="Bu not müşteriye görünmez. Sadece Backoffice içindir."
        />
      </FormSection>

      <SubmitButton isSaving={isSaving} label={submitLabel} />
    </form>
  );
}

export function OfferItemForm({
  artists,
  technicalServices,
  onSubmit,
  onDone,
}: {
  artists: ArtistService[];
  technicalServices: TechnicalService[];
  onSubmit: (payload: OfferItemCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [sourceType, setSourceType] = useState<
    "artist" | "technical_service" | "manual"
  >("artist");
  const [artistId, setArtistId] = useState("");
  const [technicalServiceId, setTechnicalServiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [programSection, setProgramSection] = useState("main_performance");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [internalCost, setInternalCost] = useState("");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [isVisibleOnOffer, setIsVisibleOnOffer] = useState(true);
  const [sortOrder, setSortOrder] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function clearCatalogSelection(
    nextSourceType: "artist" | "technical_service" | "manual"
  ) {
    setSourceType(nextSourceType);
    setArtistId("");
    setTechnicalServiceId("");
    setTitle("");
    setDescription("");
    setProgramSection(
      nextSourceType === "technical_service" ? "technical" : "main_performance"
    );
    setStartTime("");
    setEndTime("");
    setQuantity("1");
    setUnitPrice("");
    setInternalCost("");
    setCurrency("TRY");
    setIsVisibleOnOffer(true);
  }

  function handleArtistChange(value: string) {
    setArtistId(value);
    setTechnicalServiceId("");

    const selectedArtist = artists.find((artist) => String(artist.id) === value);

    if (!selectedArtist) {
      return;
    }

    setTitle(selectedArtist.name);
    setDescription(selectedArtist.notes ?? "");
    setProgramSection("main_performance");
    setQuantity("1");
    setUnitPrice(String(selectedArtist.default_sale_amount));
    setInternalCost(String(selectedArtist.default_cost_amount));
    setCurrency(selectedArtist.default_sale_currency);
    setIsVisibleOnOffer(true);
  }

  function handleTechnicalServiceChange(value: string) {
    setTechnicalServiceId(value);
    setArtistId("");

    const selectedService = technicalServices.find(
      (service) => String(service.id) === value
    );

    if (!selectedService) {
      return;
    }

    setTitle(selectedService.name);
    setDescription(selectedService.notes ?? "");
    setProgramSection("technical");
    setQuantity("1");
    setUnitPrice(String(selectedService.default_sale_amount));
    setInternalCost(String(selectedService.default_cost_amount));
    setCurrency(selectedService.default_sale_currency);
    setIsVisibleOnOffer(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sourceType === "artist" && !artistId) {
      return;
    }

    if (sourceType === "technical_service" && !technicalServiceId) {
      return;
    }

    if (!title.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        source_type: sourceType,
        artist_id: sourceType === "artist" ? Number(artistId) : null,
        service_item_id:
          sourceType === "technical_service"
            ? Number(technicalServiceId)
            : null,
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
    <form onSubmit={handleSubmit} className="grid gap-5">
      <FormSection
        eyebrow="1. Adım"
        title="Kalem Kaynağı"
        description="Katalogdaki sanatçı veya teknik hizmeti seçebilir, istersen manuel kalem de oluşturabilirsin."
      >
        <div className="grid gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => clearCatalogSelection("artist")}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              sourceType === "artist"
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Sanatçı
          </button>

          <button
            type="button"
            onClick={() => clearCatalogSelection("technical_service")}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              sourceType === "technical_service"
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Teknik Hizmet
          </button>

          <button
            type="button"
            onClick={() => clearCatalogSelection("manual")}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              sourceType === "manual"
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Manuel Kalem
          </button>
        </div>

        {sourceType === "artist" ? (
          <SelectField
            label="Katalogdan sanatçı seç"
            value={artistId}
            required
            onChange={handleArtistChange}
            options={[
              { value: "", label: "Sanatçı seçiniz" },
              ...artists.map((artist) => ({
                value: String(artist.id),
                label: `${artist.name} • ${formatMoney(
                  artist.default_sale_amount,
                  artist.default_sale_currency
                )}`,
              })),
            ]}
          />
        ) : null}

        {sourceType === "technical_service" ? (
          <SelectField
            label="Katalogdan teknik / operasyon hizmeti seç"
            value={technicalServiceId}
            required
            onChange={handleTechnicalServiceChange}
            options={[
              { value: "", label: "Teknik hizmet seçiniz" },
              ...technicalServices.map((service) => ({
                value: String(service.id),
                label: `${service.name} • ${formatMoney(
                  service.default_sale_amount,
                  service.default_sale_currency
                )}`,
              })),
            ]}
          />
        ) : null}
      </FormSection>

      <FormSection
        eyebrow="2. Adım"
        title="Teklif Kalemi"
        description="Katalogdan seçilen bilgiler otomatik gelir; teklif özelinde fiyatı değiştirebilirsin."
      >
        <TextField
          label="Kalem başlığı"
          value={title}
          onChange={setTitle}
          placeholder="Örn: Sanatçı performansı"
          required
        />

        <TextareaField
          label="Açıklama"
          value={description}
          onChange={setDescription}
          placeholder="Müşteri çıktısında görünmesini istediğin açıklama."
        />

        <div className="grid gap-3 md:grid-cols-3">
          <SelectField
            label="Program bölümü"
            value={programSection}
            onChange={setProgramSection}
            options={programSectionOptions}
          />

          <TextField
            type="time"
            label="Başlangıç"
            value={startTime}
            onChange={setStartTime}
          />

          <TextField
            type="time"
            label="Bitiş"
            value={endTime}
            onChange={setEndTime}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <NumberField
            label="Sıra"
            value={sortOrder}
            onChange={setSortOrder}
            placeholder="Otomatik"
            min="0"
            step="1"
          />

          <NumberField
            label="Adet"
            value={quantity}
            onChange={setQuantity}
            min="1"
            step="1"
          />

          <NumberField
            label="Satış fiyatı"
            value={unitPrice}
            onChange={setUnitPrice}
            placeholder="0"
            min="0"
            step="0.01"
          />

          <NumberField
            label="İç maliyet"
            value={internalCost}
            onChange={setInternalCost}
            placeholder="0"
            min="0"
            step="0.01"
          />

          <SelectField
            label="Para birimi"
            value={currency}
            onChange={(value) => setCurrency(value as Currency)}
            options={currencySelectOptions}
          />
        </div>

        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isVisibleOnOffer}
            onChange={(event) => setIsVisibleOnOffer(event.target.checked)}
          />
          Müşteri teklifinde görünsün
        </label>
      </FormSection>

      <SubmitButton isSaving={isSaving} label="Kalemi Kaydet" />
    </form>
  );
}

function FormSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-700">
        {eyebrow}
      </p>

      <h3 className="mt-2 text-xl font-black text-slate-950">{title}</h3>

      {description ? (
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      ) : null}

      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: "text" | "time";
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
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

function MoneyField({
  label,
  value,
  currency,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  currency: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-2 flex overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 focus-within:ring-4 focus-within:ring-teal-500">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
        />
        <span className="flex items-center border-l border-slate-200 bg-white px-4 text-sm font-black text-slate-700">
          {currency}
        </span>
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
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
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select
        value={value}
        required={required}
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
      />
    </label>
  );
}

function SubmitButton({
  isSaving,
  label,
}: {
  isSaving: boolean;
  label: string;
}) {
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