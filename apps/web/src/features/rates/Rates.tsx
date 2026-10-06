import { Coins, Pencil, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";

import { useCan } from "@/features/auth/auth";
import { useFetchRates, useRates, useSetRate, type Rate } from "@/features/rates/api";
import { formatDate, formatNumber, todayISO } from "@/shared/lib/format";
import { parseRateInput } from "@/shared/lib/validation";
import { Button, Dialog, Field, FormError, Input, toast } from "@/shared/ui";

const SOURCE = { tcmb: "TCMB", manual: "Elle" } as const;

export function RateDialog({ rate, onClose }: { rate: Rate | null; onClose: () => void }) {
  const save = useSetRate();
  const [day, setDay] = useState(todayISO());
  const [value, setValue] = useState("");
  const parsed = parseRateInput(value);
  const close = () => {
    save.reset();
    setValue("");
    setDay(todayISO());
    onClose();
  };
  return (
    <Dialog
      open={rate !== null}
      onOpenChange={(o) => !o && close()}
      title={`${rate?.currency ?? ""} Kurunu Gir`}
      description="Formlarda öneri olarak kullanılır. Daha önce girilmiş kayıtların kuru değişmez."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Vazgeç
          </Button>
          <Button
            loading={save.isPending}
            disabled={parsed === null}
            onClick={() =>
              rate &&
              parsed !== null &&
              save.mutate(
                { day, currency: rate.currency, rate: parsed },
                {
                  onSuccess: () => {
                    toast.success("Kur kaydedildi.");
                    close();
                  },
                },
              )
            }
          >
            Kaydet
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="Tarih">{(p) => <Input {...p} type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} />}</Field>
        <Field label={`1 ${rate?.currency ?? ""} = ? TL`} required hint={rate ? `Şu an: ${formatNumber(rate.rate)} (${SOURCE[rate.source]})` : undefined}>
          {(p) => <Input {...p} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="55,0757" />}
        </Field>
        <FormError error={save.error} />
      </div>
    </Dialog>
  );
}

const SYMBOL: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

function previousDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function Change({ now, before }: { now: number; before?: number }) {
  if (!before) return null;
  if (before === now) return <span className="text-xs text-brand-200">değişmedi</span>;
  const up = now > before;
  const pct = ((now - before) / before) * 100;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-danger-50" : "text-success-50"}`}>
      {up ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
      {up ? "+" : ""}
      {formatNumber(pct.toFixed(2))}%
      <span className="sr-only">{up ? "arttı" : "azaldı"} (önceki güne göre)</span>
    </span>
  );
}

/** Finans Merkezi'nin en üstündeki kur bandı: TCMB döviz satış, önceki güne göre değişim. */
export function RatesStrip() {
  const can = useCan();
  const canEdit = can("finance.record") || can("offers.manage");
  const rates = useRates();
  const day = rates.data?.[0]?.day;
  const previous = useRates(day ? previousDay(day) : undefined, Boolean(day));
  const fetch = useFetchRates();
  const [editing, setEditing] = useState<Rate | null>(null);
  const before = (currency: string) => {
    const p = previous.data?.find((r) => r.currency === currency);
    return p && p.day !== day ? Number(p.rate) : undefined;
  };

  return (
    <section aria-labelledby="rates-title" className="mb-6 overflow-hidden rounded-xl bg-brand-900 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <Coins className="size-4 text-accent-500" aria-hidden />
          <h2 id="rates-title" className="text-sm font-semibold tracking-wide text-white">
            Günün Kurları
          </h2>
          <span className="text-xs text-brand-200">
            {day ? `TCMB döviz satış · ${formatDate(day, "long")}` : "Kur bilgisi yok"}
          </span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() =>
              fetch.mutate(undefined, {
                onSuccess: () => toast.success("Kurlar TCMB'den güncellendi."),
                onError: (e) => toast.error(e.message),
              })
            }
            disabled={fetch.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-brand-100 hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${fetch.isPending ? "animate-spin" : ""}`} aria-hidden /> TCMB'den güncelle
          </button>
        )}
      </div>
      <ul className="grid grid-cols-3 divide-x divide-white/10">
        {(rates.data ?? []).map((r) => (
          <li key={r.currency} className="relative flex items-center gap-4 px-3 py-3 sm:px-5 sm:py-4">
            <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-accent-500/15 font-display text-xl text-accent-500 sm:grid" aria-hidden>
              {SYMBOL[r.currency] ?? r.currency}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wider text-brand-200">
                <span className="text-accent-500 sm:hidden">{SYMBOL[r.currency]} </span>
                {r.currency}
                <span className="hidden sm:inline"> / TL</span>
              </p>
              <p className="font-display text-lg leading-tight tabular sm:text-2xl">{formatNumber(Number(r.rate).toFixed(4))}</p>
              <div className="flex flex-wrap items-center gap-x-2">
                <Change now={Number(r.rate)} before={before(r.currency)} />
                {r.source === "manual" && <span className="rounded bg-warning-50 px-1.5 text-[11px] font-medium text-warning-700">Elle</span>}
              </div>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(r)}
                aria-label={`${r.currency} kurunu düzelt`}
                className="absolute top-1.5 right-1.5 rounded-md p-1.5 text-brand-200 hover:bg-white/10 hover:text-white sm:static sm:p-2"
              >
                <Pencil className="size-4" />
              </button>
            )}
          </li>
        ))}
        {rates.isPending && <li className="col-span-3 px-5 py-6 text-sm text-brand-200">Kurlar yükleniyor…</li>}
        {rates.data?.length === 0 && (
          <li className="col-span-3 px-5 py-6 text-sm text-brand-200">Henüz kur yok. "TCMB'den güncelle" ile alın.</li>
        )}
      </ul>
      <RateDialog rate={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

/** Üst çubukta her sayfada görünen kısa kur göstergesi. */
export function HeaderRates() {
  const rates = useRates();
  if (!rates.data?.length) return null;
  return (
    <Link
      to="/finans"
      className="hidden items-center gap-3 rounded-md border border-accent-100 bg-accent-50 px-3 py-1.5 text-sm md:inline-flex hover:border-accent-500"
      aria-label={`Günün kurları: ${rates.data.map((r) => `${r.currency} ${formatNumber(Number(r.rate).toFixed(4))} TL`).join(", ")}`}
    >
      {rates.data.map((r) => (
        <span key={r.currency} className="tabular text-ink-soft" aria-hidden>
          <span className="font-semibold text-accent-700">{SYMBOL[r.currency] ?? r.currency}</span>{" "}
          {formatNumber(Number(r.rate).toFixed(2))}
        </span>
      ))}
    </Link>
  );
}
