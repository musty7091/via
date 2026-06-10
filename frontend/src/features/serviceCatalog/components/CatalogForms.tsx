import { FormEvent, useState } from "react";

import {
  artistTypeOptions,
  componentTypeOptions,
  currencyOptions,
  packageTypeOptions,
  programSectionOptions,
  serviceTypeOptions,
} from "../constants/serviceCatalogConstants";
import type {
  ArtistCreatePayload,
  ArtistService,
  PackageItemCreatePayload,
  RiderCreatePayload,
  ServicePackageCreatePayload,
  TechnicalService,
  TechnicalServiceCreatePayload,
} from "../types/serviceCatalogTypes";
import type { Currency } from "../types/serviceCatalogTypes";

type ModalShellProps = {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
}: ModalShellProps) {
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
    <form onSubmit={handleSubmit} className="grid gap-4">
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

      <div className="grid gap-3 md:grid-cols-2">
        <NumberField label="Maliyet tutarı" value={cost} onChange={setCost} />

        <SelectField
          label="Maliyet para birimi"
          value={costCurrency}
          onChange={(value) => setCostCurrency(value as Currency)}
          options={
            currencyOptions as unknown as Array<{ value: string; label: string }>
          }
        />

        <NumberField label="Teklif tutarı" value={sale} onChange={setSale} />

        <SelectField
          label="Teklif para birimi"
          value={saleCurrency}
          onChange={(value) => setSaleCurrency(value as Currency)}
          options={
            currencyOptions as unknown as Array<{ value: string; label: string }>
          }
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
}: {
  onSubmit: (payload: TechnicalServiceCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [serviceType, setServiceType] = useState("technical_service");
  const [name, setName] = useState("");
  const [cost, setCost] = useState("0");
  const [sale, setSale] = useState("0");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [notes, setNotes] = useState("");
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
        default_cost_currency: currency,
        default_sale_amount: Number(sale || 0),
        default_sale_currency: currency,
        notes: notes.trim() || null,
        is_active: true,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <SelectField
        label="Hizmet tipi"
        value={serviceType}
        onChange={setServiceType}
        options={serviceTypeOptions}
      />

      <TextField label="Hizmet adı" value={name} onChange={setName} required />

      <div className="grid gap-3 md:grid-cols-3">
        <NumberField label="Maliyet" value={cost} onChange={setCost} />
        <NumberField label="Teklif" value={sale} onChange={setSale} />

        <SelectField
          label="Para birimi"
          value={currency}
          onChange={(value) => setCurrency(value as Currency)}
          options={
            currencyOptions as unknown as Array<{ value: string; label: string }>
          }
        />
      </div>

      <TextareaField label="Not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label="Teknik Hizmeti Kaydet" />
    </form>
  );
}

export function PackageForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (payload: ServicePackageCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [packageType, setPackageType] = useState("program");
  const [name, setName] = useState("");
  const [sale, setSale] = useState("0");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
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
        is_active: true,
      });

      onDone();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <SelectField
        label="Paket tipi"
        value={packageType}
        onChange={setPackageType}
        options={packageTypeOptions}
      />

      <TextField label="Paket adı" value={name} onChange={setName} required />

      <div className="grid gap-3 md:grid-cols-2">
        <NumberField
          label="Varsayılan teklif"
          value={sale}
          onChange={setSale}
        />

        <SelectField
          label="Para birimi"
          value={currency}
          onChange={(value) => setCurrency(value as Currency)}
          options={
            currencyOptions as unknown as Array<{ value: string; label: string }>
          }
        />
      </div>

      <TextareaField
        label="Müşteriye gösterilecek açıklama"
        value={description}
        onChange={setDescription}
      />

      <TextareaField label="İç not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label="Paketi Kaydet" />
    </form>
  );
}

export function RiderForm({
  onSubmit,
  onDone,
}: {
  onSubmit: (payload: RiderCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("kulis");
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
    <form onSubmit={handleSubmit} className="grid gap-4">
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

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(event) => setIsRequired(event.target.checked)}
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
  onSubmit,
  onDone,
}: {
  artists: ArtistService[];
  services: TechnicalService[];
  onSubmit: (payload: PackageItemCreatePayload) => Promise<void>;
  onDone: () => void;
}) {
  const [componentType, setComponentType] = useState("artist");
  const [artistId, setArtistId] = useState("");
  const [serviceItemId, setServiceItemId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [programSection, setProgramSection] = useState("opening");
  const [sortOrder, setSortOrder] = useState("1");
  const [startTime, setStartTime] = useState("20:00");
  const [endTime, setEndTime] = useState("21:00");
  const [cost, setCost] = useState("0");
  const [sale, setSale] = useState("0");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [isVisibleOnOffer, setIsVisibleOnOffer] = useState(true);
  const [isOptional, setIsOptional] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function fillFromSelected(value: string, type: "artist" | "service") {
    if (type === "artist") {
      setArtistId(value);

      const artist = artists.find((item) => item.id === Number(value));

      if (artist) {
        setCost(String(artist.default_cost_amount));
        setSale(String(artist.default_sale_amount));
        setCurrency(artist.default_sale_currency);
      }

      return;
    }

    setServiceItemId(value);

    const service = services.find((item) => item.id === Number(value));

    if (service) {
      setCost(String(service.default_cost_amount));
      setSale(String(service.default_sale_amount));
      setCurrency(service.default_sale_currency);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);

    try {
      await onSubmit({
        component_type: componentType,
        artist_id: componentType === "artist" ? Number(artistId) || null : null,
        service_item_id:
          componentType === "service" ? Number(serviceItemId) || null : null,
        title: componentType === "manual" ? manualTitle.trim() : null,
        program_section: programSection,
        sort_order: Number(sortOrder || 0),
        start_time: startTime ? `${startTime}:00` : null,
        end_time: endTime ? `${endTime}:00` : null,
        quantity: 1,
        unit_cost_amount: Number(cost || 0),
        unit_cost_currency: currency,
        unit_sale_amount: Number(sale || 0),
        unit_sale_currency: currency,
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
    <form onSubmit={handleSubmit} className="grid gap-4">
      <SelectField
        label="Bileşen tipi"
        value={componentType}
        onChange={setComponentType}
        options={componentTypeOptions}
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
          label="Manuel kalem başlığı"
          value={manualTitle}
          onChange={setManualTitle}
          required
        />
      ) : null}

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

      <div className="grid gap-3 md:grid-cols-4">
        <NumberField label="Sıra" value={sortOrder} onChange={setSortOrder} />
        <NumberField label="Maliyet" value={cost} onChange={setCost} />
        <NumberField label="Teklif" value={sale} onChange={setSale} />

        <SelectField
          label="Para birimi"
          value={currency}
          onChange={(value) => setCurrency(value as Currency)}
          options={
            currencyOptions as unknown as Array<{ value: string; label: string }>
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isVisibleOnOffer}
            onChange={(event) => setIsVisibleOnOffer(event.target.checked)}
          />
          Müşteri teklifinde görünsün
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={isOptional}
            onChange={(event) => setIsOptional(event.target.checked)}
          />
          Opsiyonel
        </label>
      </div>

      <TextareaField label="Not" value={notes} onChange={setNotes} />

      <SubmitButton isSaving={isSaving} label="Akış Kalemini Kaydet" />
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