import {
  artistTypeOptions,
  getOptionLabel,
  packageTypeOptions,
  programSectionOptions,
  serviceTypeOptions,
} from "../constants/serviceCatalogConstants";
import type {
  ArtistService,
  RiderItem,
  ServicePackageDetail,
  TechnicalService,
} from "../types/serviceCatalogTypes";
import { formatMoney, formatTime } from "./formatters";

type ArtistDetailProps = {
  artist: ArtistService;
  riderItems: RiderItem[];
  onOpenRiderForm: () => void;
};

export function ArtistDetail({
  artist,
  riderItems,
  onOpenRiderForm,
}: ArtistDetailProps) {
  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Sanatçı Hizmeti"
        title={artist.name}
        badge={getOptionLabel(artistTypeOptions, artist.artist_type)}
        description={artist.notes}
      />

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
              Rider Şablonu
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Operasyon ekibine aktarılacak kulis ve teknik hazırlık maddeleri.
            </p>
          </div>
          <button
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
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {riderItems.map((item) => (
              <article key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-black text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.category ?? "Genel"} • {item.is_required ? "Zorunlu" : "Opsiyonel"}
                </p>
                {item.description ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

type TechnicalServiceDetailProps = {
  service: TechnicalService;
};

export function TechnicalServiceDetail({ service }: TechnicalServiceDetailProps) {
  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Teknik / Operasyon Hizmeti"
        title={service.name}
        badge={getOptionLabel(serviceTypeOptions, service.service_type)}
        description={service.notes}
      />

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
};

export function PackageDetail({ detail, onOpenItemForm }: PackageDetailProps) {
  return (
    <section className="space-y-4">
      <HeaderCard
        eyebrow="Paket / Program"
        title={detail.package.name}
        badge={getOptionLabel(packageTypeOptions, detail.package.package_type)}
        description={detail.package.description}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          title="Toplam Maliyet"
          value={formatMoney(detail.summary.total_cost_amount)}
        />
        <MetricCard
          title="Teklif Tutarı"
          value={formatMoney(detail.summary.total_sale_amount)}
        />
        <MetricCard
          title="Brüt Kâr"
          value={formatMoney(detail.summary.gross_profit_amount)}
        />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Program Akışı
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Müşteriye sunulacak program sırası ve içeride izlenecek maliyetler.
            </p>
          </div>

          <button
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
                className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 lg:grid-cols-[90px_1fr_130px_130px_130px]"
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
                    {getOptionLabel(programSectionOptions, item.program_section)}
                    {item.is_optional ? " • Opsiyonel" : ""}
                  </p>
                </div>

                <div className="text-sm font-bold text-slate-700">
                  Maliyet
                  <br />
                  {formatMoney(item.total_cost_amount, item.unit_cost_currency)}
                </div>

                <div className="text-sm font-bold text-slate-700">
                  Teklif
                  <br />
                  {formatMoney(item.total_sale_amount, item.unit_sale_currency)}
                </div>

                <div className="text-sm font-black text-teal-700">
                  Kâr
                  <br />
                  {formatMoney(item.gross_profit_amount, item.unit_sale_currency)}
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
      <MetricCard title="Varsayılan Maliyet" value={formatMoney(cost, costCurrency)} />
      <MetricCard title="Varsayılan Teklif" value={formatMoney(sale, saleCurrency)} />
      <MetricCard
        title="Tahmini Brüt Kâr"
        value={saleCurrency === costCurrency ? formatMoney(profit, saleCurrency) : "Kur farkı var"}
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
