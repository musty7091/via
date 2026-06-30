import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import {
  artistTypeOptions,
  currencyOptions,
  packageTypeOptions,
  programSectionOptions,
  serviceTypeOptions,
} from "../constants/serviceCatalogConstants";
import type {
  ArtistCreatePayload,
  ArtistService,
  Currency,
  PackageItemCreatePayload,
  ServicePackage,
  ServicePackageCreatePayload,
  TechnicalService,
  TechnicalServiceCreatePayload,
} from "../types/serviceCatalogTypes";

type ModalShellProps = {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
};

const packageComponentTypeOptions = [
  { value: "artist", label: "Sanatçı Hizmeti" },
  { value: "service", label: "Teknik / Operasyon Hizmeti" },
  { value: "manual", label: "Manuel Kalem" },
];

export function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-teal-600">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-normal text-slate-800">{title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
          >
            Kapat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function ArtistForm({
  onSubmit,
  onDone,
  initialArtist,
  submitLabel = "Sanatçı Hizmetini Kaydet",
}: {
  onSubmit: (payload: ArtistCreatePayload) => Promise<void>;
  onDone: () => void;
  initialArtist?: ArtistService | null;
  submitLabel?: string;
}) {
  const [artistType, setArtistType] = useState(
    initialArtist?.artist_type ?? "solo_artist"
  );
  const [name, setName] = useState(initialArtist?.name ?? "");
  const [cost, setCost] = useState(
    String(initialArtist?.default_cost_amount ?? 0)
  );
  const [costCurrency, setCostCurrency] = useState<Currency>(
    initialArtist?.default_cost_currency ?? "TRY"
  );
  const [sale, setSale] = useState(
    String(initialArtist?.default_sale_amount ?? 0)
  );
  const [saleCurrency, setSaleCurrency] = useState<Currency>(
    initialArtist?.default_sale_currency ?? "TRY"
  );
  const [notes, setNotes] = useState(initialArtist?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        artist_type: artistType,
        name: name.trim(),
        manager_partner_id: initialArtist?.manager_partner_id ?? null,
        default_cost_amount: Number(cost || 0),
        default_cost_currency: costCurrency,
        default_sale_amount: Number(sale || 0),
        default_sale_currency: saleCurrency,
        notes: notes.trim() || null,
        is_active: initialArtist?.is_active ?? true,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <SelectField
        label="Sanatçı kategorisi"
        value={artistType}
        onChange={setArtistType}
        options={artistTypeOptions}
      />

      <TextField
        label="Sanatçı / ekip adı"
        value={name}
        onChange={setName}
        required
      />

      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="Maliyet tutarı" value={cost} onChange={setCost} />

        <SelectField
          label="Maliyet para birimi"
          value={costCurrency}
          onChange={(value) => setCostCurrency(value as Currency)}
          options={currencyOptions}
        />

        <NumberField label="Teklif tutarı" value={sale} onChange={setSale} />

        <SelectField
          label="Teklif para birimi"
          value={saleCurrency}
          onChange={(value) => setSaleCurrency(value as Currency)}
          options={currencyOptions}
        />
      </div>

      <TextareaField label="Not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label={submitLabel} />
    </form>
  );
}

export function TechnicalServiceForm({
  onSubmit,
  onDone,
  initialService,
  submitLabel = "Teknik Hizmeti Kaydet",
}: {
  onSubmit: (payload: TechnicalServiceCreatePayload) => Promise<void>;
  onDone: () => void;
  initialService?: TechnicalService | null;
  submitLabel?: string;
}) {
  const [serviceType, setServiceType] = useState(
    initialService?.service_type ?? "technical_service"
  );
  const [name, setName] = useState(initialService?.name ?? "");
  const [cost, setCost] = useState(
    String(initialService?.default_cost_amount ?? 0)
  );
  const [costCurrency, setCostCurrency] = useState<Currency>(
    initialService?.default_cost_currency ?? "TRY"
  );
  const [sale, setSale] = useState(
    String(initialService?.default_sale_amount ?? 0)
  );
  const [saleCurrency, setSaleCurrency] = useState<Currency>(
    initialService?.default_sale_currency ?? "TRY"
  );
  const [notes, setNotes] = useState(initialService?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        service_type: serviceType,
        name: name.trim(),
        default_cost_amount: Number(cost || 0),
        default_cost_currency: costCurrency,
        default_sale_amount: Number(sale || 0),
        default_sale_currency: saleCurrency,
        notes: notes.trim() || null,
        is_active: initialService?.is_active ?? true,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <SelectField
        label="Hizmet tipi"
        value={serviceType}
        onChange={setServiceType}
        options={serviceTypeOptions}
      />

      <TextField label="Hizmet adı" value={name} onChange={setName} required />

      <div className="grid gap-4 md:grid-cols-2">
        <NumberField label="Maliyet tutarı" value={cost} onChange={setCost} />

        <SelectField
          label="Maliyet para birimi"
          value={costCurrency}
          onChange={(value) => setCostCurrency(value as Currency)}
          options={currencyOptions}
        />

        <NumberField label="Teklif tutarı" value={sale} onChange={setSale} />

        <SelectField
          label="Teklif para birimi"
          value={saleCurrency}
          onChange={(value) => setSaleCurrency(value as Currency)}
          options={currencyOptions}
        />
      </div>

      <TextareaField label="Not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label={submitLabel} />
    </form>
  );
}

export function PackageForm({
  onSubmit,
  onDone,
  initialPackage,
  submitLabel = "Paketi Kaydet",
}: {
  onSubmit: (payload: ServicePackageCreatePayload) => Promise<void>;
  onDone: () => void;
  initialPackage?: ServicePackage | null;
  submitLabel?: string;
}) {
  const [packageType, setPackageType] = useState(
    initialPackage?.package_type ?? "program"
  );
  const [name, setName] = useState(initialPackage?.name ?? "");
  const [sale, setSale] = useState(
    String(initialPackage?.default_sale_amount ?? 0)
  );
  const [currency, setCurrency] = useState<Currency>(
    initialPackage?.default_sale_currency ?? "TRY"
  );
  const [description, setDescription] = useState(
    initialPackage?.description ?? ""
  );
  const [notes, setNotes] = useState(initialPackage?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        package_type: packageType,
        name: name.trim(),
        description: description.trim() || null,
        default_sale_amount: Number(sale || 0),
        default_sale_currency: currency,
        notes: notes.trim() || null,
        is_active: initialPackage?.is_active ?? true,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <SelectField
        label="Paket tipi"
        value={packageType}
        onChange={setPackageType}
        options={packageTypeOptions}
      />

      <TextField label="Paket adı" value={name} onChange={setName} required />

      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label="Varsayılan paket satış fiyatı"
          value={sale}
          onChange={setSale}
        />

        <SelectField
          label="Para birimi"
          value={currency}
          onChange={(value) => setCurrency(value as Currency)}
          options={currencyOptions}
        />
      </div>

      <TextareaField
        label="Müşteriye gösterilecek açıklama"
        value={description}
        onChange={setDescription}
      />

      <TextareaField label="İç not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label={submitLabel} />
    </form>
  );
}

export function RiderForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (payload: {
    title: string;
    description?: string | null;
    category?: string | null;
    sort_order: number;
    is_required: boolean;
    is_active?: boolean;
  }) => Promise<void>;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Genel");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);
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
        category: category.trim() || null,
        description: description.trim() || null,
        sort_order: 0,
        is_required: isRequired,
        is_active: true,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <TextField
        label="Rider başlığı"
        value={title}
        onChange={setTitle}
        required
      />

      <TextField label="Kategori" value={category} onChange={setCategory} />

      <TextareaField
        label="Açıklama"
        value={description}
        onChange={setDescription}
      />

      <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(event) => setIsRequired(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        Zorunlu hazırlık maddesi
      </label>

      <SubmitButton isSaving={isSaving} label="Rider Maddesini Kaydet" />
    </form>
  );
}

export function PackageItemForm({
  artists,
  services,
  nextSortOrder,
  onSubmit,
  onDone,
}: {
  artists: ArtistService[];
  services: TechnicalService[];
  nextSortOrder: number;
  onSubmit: (payload: PackageItemCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [componentType, setComponentType] = useState("artist");
  const [artistId, setArtistId] = useState("");
  const [serviceItemId, setServiceItemId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [programSection, setProgramSection] = useState("main_performance");
  const [sortOrder, setSortOrder] = useState(String(nextSortOrder));
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("0");
  const [costCurrency, setCostCurrency] = useState<Currency>("TRY");
  const [sale, setSale] = useState("0");
  const [saleCurrency, setSaleCurrency] = useState<Currency>("TRY");
  const [isVisibleOnOffer, setIsVisibleOnOffer] = useState(true);
  const [isOptional, setIsOptional] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const totalCost = useMemo(
    () => Number(quantity || 0) * Number(cost || 0),
    [cost, quantity]
  );

  const totalSale = useMemo(
    () => Number(quantity || 0) * Number(sale || 0),
    [quantity, sale]
  );

  function handleComponentTypeChange(value: string) {
    setComponentType(value);
    setArtistId("");
    setServiceItemId("");
    setManualTitle("");
    setCost("0");
    setSale("0");
    setCostCurrency("TRY");
    setSaleCurrency("TRY");
  }

  function fillFromSelected(value: string, type: "artist" | "service") {
    if (type === "artist") {
      setArtistId(value);

      const artist = artists.find((item) => item.id === Number(value));

      if (artist) {
        setCost(String(artist.default_cost_amount));
        setCostCurrency(artist.default_cost_currency);
        setSale(String(artist.default_sale_amount));
        setSaleCurrency(artist.default_sale_currency);
      }

      return;
    }

    setServiceItemId(value);

    const service = services.find((item) => item.id === Number(value));

    if (service) {
      setCost(String(service.default_cost_amount));
      setCostCurrency(service.default_cost_currency);
      setSale(String(service.default_sale_amount));
      setSaleCurrency(service.default_sale_currency);
    }
  }

  function getSelectedTitle() {
    if (componentType === "artist") {
      return (
        artists.find((artist) => artist.id === Number(artistId))?.name ?? null
      );
    }

    if (componentType === "service") {
      return (
        services.find((service) => service.id === Number(serviceItemId))?.name ??
        null
      );
    }

    return manualTitle.trim() || null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedTitle = getSelectedTitle();

    if (!selectedTitle) {
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        component_type: componentType,
        artist_id: componentType === "artist" ? Number(artistId) || null : null,
        service_item_id:
          componentType === "service" ? Number(serviceItemId) || null : null,
        title: selectedTitle,
        program_section: programSection || null,
        sort_order: Number(sortOrder || 0),
        start_time: null,
        end_time: null,
        quantity: Number(quantity || 1),
        unit_cost_amount: Number(cost || 0),
        unit_cost_currency: costCurrency,
        unit_sale_amount: Number(sale || 0),
        unit_sale_currency: saleCurrency,
        is_optional: isOptional,
        is_visible_on_offer: isVisibleOnOffer,
        is_active: true,
        notes: notes.trim() || null,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <SelectField
        label="Kalem tipi"
        value={componentType}
        onChange={handleComponentTypeChange}
        options={packageComponentTypeOptions}
      />

      {componentType === "artist" ? (
        <SelectField
          label="Sanatçı hizmeti"
          value={artistId}
          onChange={(value) => fillFromSelected(value, "artist")}
          options={[
            { value: "", label: "Seçiniz" },
            ...artists.map((artist) => ({
              value: String(artist.id),
              label: artist.name,
            })),
          ]}
        />
      ) : null}

      {componentType === "service" ? (
        <SelectField
          label="Teknik / operasyon hizmeti"
          value={serviceItemId}
          onChange={(value) => fillFromSelected(value, "service")}
          options={[
            { value: "", label: "Seçiniz" },
            ...services.map((service) => ({
              value: String(service.id),
              label: service.name,
            })),
          ]}
        />
      ) : null}

      {componentType === "manual" ? (
        <TextField
          label="Manuel kalem adı"
          value={manualTitle}
          onChange={setManualTitle}
          required
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          label="Program bölümü"
          value={programSection}
          onChange={setProgramSection}
          options={programSectionOptions}
        />

        <NumberField label="Sıra" value={sortOrder} onChange={setSortOrder} />

        <NumberField label="Adet" value={quantity} onChange={setQuantity} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label="Paket içi birim maliyet"
          value={cost}
          onChange={setCost}
        />

        <SelectField
          label="Maliyet para birimi"
          value={costCurrency}
          onChange={(value) => setCostCurrency(value as Currency)}
          options={currencyOptions}
        />

        <NumberField
          label="Paket içi satış etkisi"
          value={sale}
          onChange={setSale}
        />

        <SelectField
          label="Satış para birimi"
          value={saleCurrency}
          onChange={(value) => setSaleCurrency(value as Currency)}
          options={currencyOptions}
        />
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 md:grid-cols-2">
        <SummaryLine
          label="Toplam maliyet"
          value={formatSimpleMoney(totalCost, costCurrency)}
        />
        <SummaryLine
          label="Toplam satış etkisi"
          value={formatSimpleMoney(totalSale, saleCurrency)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isVisibleOnOffer}
            onChange={(event) => setIsVisibleOnOffer(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Müşteri teklifinde görünsün
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(event) => setIsOptional(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Opsiyonel kalem
        </label>
      </div>

      <TextareaField label="İç not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label="Paket Kalemini Ekle" />
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
      <span className="text-sm font-medium text-slate-600">{label}</span>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-400"
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
      <span className="text-sm font-medium text-slate-600">{label}</span>

      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-400"
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
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-400"
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
      <span className="text-sm font-medium text-slate-600">{label}</span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-400"
      />
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-medium text-slate-800">{value}</p>
    </div>
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
      className="rounded-full bg-slate-800 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 mt-2"
    >
      {isSaving ? "Kaydediliyor..." : label}
    </button>
  );
}

function formatSimpleMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}