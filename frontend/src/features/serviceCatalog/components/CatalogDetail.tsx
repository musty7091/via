import type { ReactNode } from "react";

import {
  artistTypeOptions,
  getOptionLabel,
  packageTypeOptions,
  programSectionOptions,
  serviceTypeOptions,
} from "../constants/serviceCatalogConstants";
import type {
  ArtistService,
  PackageItem,
  RiderItem,
  ServicePackageDetail,
  TechnicalService,
} from "../types/serviceCatalogTypes";
import { formatMoney } from "./formatters";

type ArtistDetailProps = {
  artist: ArtistService;
  riderItems: RiderItem[];
  onOpenRiderForm: () => void;
  onOpenEdit: () => void;
};

export function ArtistDetail({
  artist,
  riderItems,
  onOpenRiderForm,
  onOpenEdit,
}: ArtistDetailProps) {
  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Sanatçı Hizmeti"
        title={artist.name}
        badge={getOptionLabel(artistTypeOptions, artist.artist_type)}
        description={artist.notes}
      />

      <div className="flex justify-end">
        <SecondaryActionButton onClick={onOpenEdit}>
          Sanatçı Bilgilerini Düzenle
        </SecondaryActionButton>
      </div>

      <MoneyGrid
        cost={artist.default_cost_amount}
        costCurrency={artist.default_cost_currency}
        sale={artist.default_sale_amount}
        saleCurrency={artist.default_sale_currency}
      />

      <ChecklistSection
        title="Rider Checklist"
        description="Sanatçı için operasyon öncesi kontrol edilecek rider maddeleri."
        buttonLabel="Rider Ekle"
        onAdd={onOpenRiderForm}
        items={riderItems.map((item) => ({
          id: item.id,
          title: item.title,
        }))}
        emptyText="Henüz rider maddesi yok."
      />
    </section>
  );
}

type TechnicalServiceDetailProps = {
  service: TechnicalService;
  onOpenEdit: () => void;
};

export function TechnicalServiceDetail({
  service,
  onOpenEdit,
}: TechnicalServiceDetailProps) {
  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Teknik / Operasyon Hizmeti"
        title={service.name}
        badge={getOptionLabel(serviceTypeOptions, service.service_type)}
        description={service.notes}
      />

      <div className="flex justify-end">
        <SecondaryActionButton onClick={onOpenEdit}>
          Hizmet Bilgilerini Düzenle
        </SecondaryActionButton>
      </div>

      <MoneyGrid
        cost={service.default_cost_amount}
        costCurrency={service.default_cost_currency}
        sale={service.default_sale_amount}
        saleCurrency={service.default_sale_currency}
      />
    </section>
  );
}

type PackageDetailProps = {
  detail: ServicePackageDetail;
  onOpenEdit: () => void;
  onOpenItemForm: () => void;
  onRemoveItem: (itemId: number) => void;
  removingItemId: number | null;
};

export function PackageDetail({
  detail,
  onOpenEdit,
  onOpenItemForm,
  onRemoveItem,
  removingItemId,
}: PackageDetailProps) {
  const packageCurrency = detail.package.default_sale_currency;
  const packageSaleAmount = detail.package.default_sale_amount;
  const costSummary = getComparableCostSummary(detail.items, packageCurrency);
  const saleImpactSummary = getComparableSaleSummary(
    detail.items,
    packageCurrency
  );
  const grossProfit =
    costSummary.isComparable ? packageSaleAmount - costSummary.amount : null;

  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Program Paketi"
        title={detail.package.name}
        badge={getOptionLabel(packageTypeOptions, detail.package.package_type)}
        description={detail.package.description}
      />

      <div className="flex justify-end">
        <SecondaryActionButton onClick={onOpenEdit}>
          Paket Bilgilerini Düzenle
        </SecondaryActionButton>
      </div>

      {/* MOBİL İÇİN: grid-cols-1 (alt alta), MASAÜSTÜ İÇİN: md:grid-cols-3 (yan yana) */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <MetricCard
          title="Paket Satış Fiyatı"
          value={formatMoney(packageSaleAmount, packageCurrency)}
        />

        <MetricCard
          title="Tahmini Toplam Maliyet"
          value={
            costSummary.isComparable
              ? formatMoney(costSummary.amount, packageCurrency)
              : "Kur gerekli"
          }
        />

        <MetricCard
          title="Tahmini Brüt Kâr"
          value={
            grossProfit !== null
              ? formatMoney(grossProfit, packageCurrency)
              : "Kur gerekli"
          }
        />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-normal text-slate-800">
              Paket İçeriği
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Sanatçı, teknik hizmet ve manuel kalemlerden oluşan hazır program şablonu.
            </p>

            <p className="mt-2 text-xs font-medium text-slate-400">
              İçerik satış etkisi:{" "}
              {saleImpactSummary.isComparable
                ? formatMoney(saleImpactSummary.amount, packageCurrency)
                : "Kur gerekli"}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenItemForm}
            className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Paket Kalemi Ekle
          </button>
        </div>

        {detail.items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Bu paketin içeriği henüz oluşturulmadı.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            {/* MOBİL İÇİN: Tablo başlıkları gizlenebilir veya kaydırılabilir */}
            <div className="hidden md:grid grid-cols-[42px_74px_minmax(0,1fr)_44px_96px_96px_44px] gap-2 bg-slate-50 px-3 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              <span>Sıra</span>
              <span>Tür</span>
              <span>Kalem</span>
              <span>Adet</span>
              <span>Maliyet</span>
              <span>Satış</span>
              <span className="text-right">Sil</span>
            </div>

            {detail.items.map((item) => (
              <PackageItemRow
                key={item.id}
                item={item}
                onRemoveItem={onRemoveItem}
                isRemoving={removingItemId === item.id}
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function PackageItemRow({
  item,
  onRemoveItem,
  isRemoving,
}: {
  item: PackageItem;
  onRemoveItem: (itemId: number) => void;
  isRemoving: boolean;
}) {
  return (
    <article className="grid grid-cols-1 md:grid-cols-[42px_74px_minmax(0,1fr)_44px_96px_96px_44px] gap-2 border-b border-slate-100 bg-white px-3 py-4 text-xs last:border-b-0">
      {/* Mobilde sıra numarası ve tür başlığı daha belirgin */}
      <div className="flex items-center gap-3 md:block">
        <span className="font-medium text-teal-700">{String(item.sort_order).padStart(2, "0")}</span>
        <span className="md:hidden text-slate-500">{getComponentTypeLabel(item.component_type)}</span>
      </div>

      <div className="hidden md:block self-center truncate font-medium text-slate-500">
        {getComponentTypeLabel(item.component_type)}
      </div>

      <div className="min-w-0 self-center">
        <p className="truncate font-medium text-slate-800">
          {getPackageItemTitle(item)}
        </p>
        {item.program_section ? (
          <p className="mt-1 truncate text-[11px] font-medium text-slate-400">
            {getOptionLabel(programSectionOptions, item.program_section)}
          </p>
        ) : null}
      </div>

      <div className="self-center font-medium text-slate-600">
        <span className="md:hidden text-slate-400 mr-2">Adet:</span>
        {item.quantity}
      </div>

      <div className="self-center truncate font-medium text-slate-700">
        <span className="md:hidden text-slate-400 mr-2">Maliyet:</span>
        {formatMoney(item.total_cost_amount, item.unit_cost_currency)}
      </div>

      <div className="self-center truncate font-medium text-slate-700">
        <span className="md:hidden text-slate-400 mr-2">Satış:</span>
        {formatMoney(item.total_sale_amount, item.unit_sale_currency)}
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          title="Kaldır"
          onClick={() => onRemoveItem(item.id)}
          disabled={isRemoving}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-sm font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-60"
        >
          {isRemoving ? "…" : "×"}
        </button>
      </div>
    </article>
  );
}

function HeaderCard({
  eyebrow,
  title,
  badge,
  description,
}: {
  eyebrow: string;
  title: string;
  badge: string;
  description?: string | null;
}) {
  return (
    <section className="rounded-[2rem] bg-slate-900 p-5 text-white shadow-md">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300">
        {eyebrow}
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl md:text-3xl font-normal text-white">{title}</h2>

        <span className="rounded-full bg-teal-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
          {badge}
        </span>
      </div>

      {description ? (
        <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-slate-200">
          {description}
        </p>
      ) : null}
    </section>
  );
}

function MoneyGrid({
  cost,
  costCurrency,
  sale,
  saleCurrency,
}: {
  cost: number;
  costCurrency: string;
  sale: number;
  saleCurrency: string;
}) {
  const profit = saleCurrency === costCurrency ? sale - cost : null;

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
      <MetricCard
        title="Varsayılan Maliyet"
        value={formatMoney(cost, costCurrency)}
      />

      <MetricCard
        title="Varsayılan Teklif"
        value={formatMoney(sale, saleCurrency)}
      />

      <MetricCard
        title="Tahmini Brüt Kâr"
        value={
          profit !== null ? formatMoney(profit, saleCurrency) : "Kur gerekli"
        }
      />
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-2xl font-normal text-slate-800">{value}</p>
    </article>
  );
}

function ChecklistSection({
  title,
  description,
  buttonLabel,
  onAdd,
  items,
  emptyText,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onAdd: () => void;
  items: Array<{ id: number; title: string }>;
  emptyText: string;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-normal text-slate-800">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 sm:w-auto w-full"
        >
          {buttonLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 last:border-b-0"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                {item.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SecondaryActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 w-full md:w-auto"
    >
      {children}
    </button>
  );
}

function getPackageItemTitle(item: PackageItem) {
  return item.artist_name ?? item.service_item_name ?? item.title;
}

function getComponentTypeLabel(value: string) {
  if (value === "artist") return "Sanatçı";
  if (value === "service") return "Teknik";
  if (value === "manual") return "Manuel";
  return value;
}

function getComparableCostSummary(items: PackageItem[], currency: string) {
  return items.reduce(
    (summary, item) => {
      if (item.unit_cost_currency !== currency) {
        return { ...summary, isComparable: false };
      }
      return { ...summary, amount: roundMoney(summary.amount + item.total_cost_amount) };
    },
    { amount: 0, isComparable: true }
  );
}

function getComparableSaleSummary(items: PackageItem[], currency: string) {
  return items.reduce(
    (summary, item) => {
      if (item.unit_sale_currency !== currency) {
        return { ...summary, isComparable: false };
      }
      return { ...summary, amount: roundMoney(summary.amount + item.total_sale_amount) };
    },
    { amount: 0, isComparable: true }
  );
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}