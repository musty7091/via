import {
  artistTypeOptions,
  getOptionLabel,
  packageTypeOptions,
  serviceTypeOptions,
} from "../constants/serviceCatalogConstants";
import type {
  ArtistService,
  ServicePackage,
  TechnicalService,
} from "../types/serviceCatalogTypes";
import { formatMoney } from "./formatters";

type CatalogListProps = {
  mode: "artists" | "services" | "packages";
  items: Array<ArtistService | TechnicalService | ServicePackage>;
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function CatalogList({
  mode,
  items,
  selectedId,
  onSelect,
}: CatalogListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm font-black text-slate-700">Kayıt bulunamadı.</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Arama metnini değiştir veya yeni kayıt oluştur.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        const typeLabel = getTypeLabel(mode, item);
        const saleAmount =
          "default_sale_amount" in item ? item.default_sale_amount : 0;
        const saleCurrency =
          "default_sale_currency" in item ? item.default_sale_currency : "TRY";

        return (
          <button
            key={`${mode}-${item.id}`}
            onClick={() => onSelect(item.id)}
            className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
              isSelected ? "bg-teal-50" : "bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">{typeLabel}</p>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  item.is_active
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {item.is_active ? "Aktif" : "Pasif"}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                Teklif: {formatMoney(saleAmount, saleCurrency)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getTypeLabel(
  mode: "artists" | "services" | "packages",
  item: ArtistService | TechnicalService | ServicePackage
) {
  if (mode === "artists" && "artist_type" in item) {
    return getOptionLabel(artistTypeOptions, item.artist_type);
  }

  if (mode === "services" && "service_type" in item) {
    return getOptionLabel(serviceTypeOptions, item.service_type);
  }

  if (mode === "packages" && "package_type" in item) {
    return getOptionLabel(packageTypeOptions, item.package_type);
  }

  return "-";
}
