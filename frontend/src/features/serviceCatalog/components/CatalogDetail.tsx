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
import { formatMoney, formatTime } from "./formatters";

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
        <button
          type="button"
          onClick={onOpenEdit}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
        >
          Sanatçı Bilgilerini Düzenle
        </button>
      </div>

      <MoneyGrid
        cost={artist.default_cost_amount}
        costCurrency={artist.default_cost_currency}
        sale={artist.default_sale_amount}
        saleCurrency={artist.default_sale_currency}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Rider Checklist
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Sanatçı için operasyon öncesi kontrol edilecek rider maddeleri.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenRiderForm}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            Rider Ekle
          </button>
        </div>

        {riderItems.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz rider maddesi yok.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            {riderItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 last:border-b-0"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50" />

                <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

type TechnicalServiceDetailProps = {
  service: TechnicalService;
  onOpenEdit?: () => void;
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

      {onOpenEdit ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenEdit}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            Hizmet Bilgilerini Düzenle
          </button>
        </div>
      ) : null}

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
  onOpenItemForm: () => void;
  onRemoveItem: (itemId: number) => void;
  removingItemId: number | null;
  onOpenEdit?: () => void;
};

export function PackageDetail({
  detail,
  onOpenItemForm,
  onRemoveItem,
  removingItemId,
  onOpenEdit,
}: PackageDetailProps) {
  const currencySummaries = buildCurrencySummaries(detail.items);

  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Paket / Program"
        title={detail.package.name}
        badge={getOptionLabel(packageTypeOptions, detail.package.package_type)}
        description={detail.package.description}
      />

      {onOpenEdit ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenEdit}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            Paket Bilgilerini Düzenle
          </button>
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Para Birimi Bazlı Özet
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Farklı para birimleri birbirine karıştırılmaz. TL, USD, EUR ve GBP
              ayrı ayrı takip edilir.
            </p>
          </div>
        </div>

        {currencySummaries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Özet için henüz program kalemi yok.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {currencySummaries.map((summary) => (
              <article
                key={summary.currency}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                  {summary.currency} Özeti
                </p>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <MiniMetric
                    title="Maliyet"
                    value={formatMoney(summary.totalCost, summary.currency)}
                  />

                  <MiniMetric
                    title="Teklif"
                    value={formatMoney(summary.totalSale, summary.currency)}
                  />

                  <MiniMetric
                    title="Brüt Kâr"
                    value={
                      summary.hasMixedItemCurrency
                        ? "Kur gerekli"
                        : formatMoney(summary.grossProfit, summary.currency)
                    }
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">Program Akışı</h3>
            <p className="mt-1 text-sm text-slate-500">
              Müşteriye sunulacak program sırası ve içeride izlenecek
              maliyetler.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenItemForm}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            Akış Kalemi Ekle
          </button>
        </div>

        {detail.items.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz program akışı yok.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            {detail.items.map((item) => (
              <article
                key={item.id}
                className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 xl:grid-cols-[90px_1fr_130px_130px_130px_90px]"
              >
                <div className="text-sm font-black text-teal-700">
                  {formatTime(item.start_time)}
                  <br />
                  <span className="text-xs text-slate-400">
                    {formatTime(item.end_time)}
                  </span>
                </div>

                <div>
                  <p className="font-black text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {getOptionLabel(
                      programSectionOptions,
                      item.program_section
                    )}
                    {item.is_optional ? " • Opsiyonel" : ""}
                  </p>
                </div>

                <AmountBlock
                  title="Maliyet"
                  amount={item.total_cost_amount}
                  currency={item.unit_cost_currency}
                />

                <AmountBlock
                  title="Teklif"
                  amount={item.total_sale_amount}
                  currency={item.unit_sale_currency}
                />

                <AmountBlock
                  title="Kâr"
                  amount={
                    item.unit_cost_currency === item.unit_sale_currency
                      ? item.gross_profit_amount
                      : 0
                  }
                  currency={item.unit_sale_currency}
                  warning={
                    item.unit_cost_currency !== item.unit_sale_currency
                      ? "Kur gerekli"
                      : undefined
                  }
                />

                <div className="flex items-start xl:justify-end">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    disabled={removingItemId === item.id}
                    className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                  >
                    {removingItemId === item.id ? "..." : "Kaldır"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
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
    <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
        {eyebrow}
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-3xl font-black">{title}</h2>

        <span className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950">
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
  const profit = saleCurrency === costCurrency ? sale - cost : 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
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
          saleCurrency === costCurrency
            ? formatMoney(profit, saleCurrency)
            : "Kur farkı var"
        }
      />
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function AmountBlock({
  title,
  amount,
  currency,
  warning,
}: {
  title: string;
  amount: number;
  currency: string;
  warning?: string;
}) {
  return (
    <div className="text-sm font-bold text-slate-700">
      {title}
      <br />
      {warning ? (
        <span className="text-amber-700">{warning}</span>
      ) : (
        formatMoney(amount, currency)
      )}
    </div>
  );
}

function buildCurrencySummaries(items: PackageItem[]) {
  const map = new Map<
    string,
    {
      currency: string;
      totalCost: number;
      totalSale: number;
      grossProfit: number;
      hasMixedItemCurrency: boolean;
    }
  >();

  items.forEach((item) => {
    if (item.unit_cost_currency !== item.unit_sale_currency) {
      const key = `${item.unit_cost_currency}/${item.unit_sale_currency}`;
      const current =
        map.get(key) ??
        {
          currency: key,
          totalCost: 0,
          totalSale: 0,
          grossProfit: 0,
          hasMixedItemCurrency: true,
        };

      current.totalCost += item.total_cost_amount;
      current.totalSale += item.total_sale_amount;
      current.hasMixedItemCurrency = true;
      map.set(key, current);
      return;
    }

    const key = item.unit_sale_currency;
    const current =
      map.get(key) ??
      {
        currency: key,
        totalCost: 0,
        totalSale: 0,
        grossProfit: 0,
        hasMixedItemCurrency: false,
      };

    current.totalCost += item.total_cost_amount;
    current.totalSale += item.total_sale_amount;
    current.grossProfit += item.gross_profit_amount;
    map.set(key, current);
  });

  return Array.from(map.values()).map((summary) => ({
    ...summary,
    totalCost: roundMoney(summary.totalCost),
    totalSale: roundMoney(summary.totalSale),
    grossProfit: roundMoney(summary.grossProfit),
  }));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}