import { AlertTriangle } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import { Link } from "react-router";

import type { Schema } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoney, formatNumber, type Currency } from "@/shared/lib/format";
import { EVENT_STATUS } from "@/shared/lib/labels";
import { Card, CardHeader } from "@/shared/ui";

export type PeriodSummary = Schema<"PeriodSummary">;

/** Ekran (kartlar) ve çıktı (sade bölümler) aynı içeriği kullanır. */
const PrintMode = createContext(false);

const tl = (v: string | number) => formatMoney(v);
const cur = (v: string | number, c: string) => formatMoney(v, c as Currency);
const pctText = (v: string | null | undefined) =>
  v == null ? "—" : Number(v) < 0 ? `−%${formatNumber(Math.abs(Number(v)))}` : `%${formatNumber(v)}`;
const signed = (v: string | number) => (Number(v) > 0 ? "text-success-700" : Number(v) < 0 ? "text-danger-700" : "");

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const print = useContext(PrintMode);
  if (print) {
    return (
      <section className="mt-6">
        <h2 className="border-b border-brand-900 pb-1 text-[11px] font-semibold tracking-[0.2em] text-brand-900 uppercase">{title}</h2>
        {description && <p className="mt-1 mb-2 text-[10.5px] text-ink-muted">{description}</p>}
        {children}
      </section>
    );
  }
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

function Tiles({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }[] }) {
  const print = useContext(PrintMode);
  return (
    <div className={print ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"}>
      {items.map((t) => (
        <div key={t.label} className={cn("border border-line bg-surface", print ? "rounded px-2 py-1.5" : "rounded-lg p-3")}>
          <p className={print ? "text-[9.5px] leading-tight text-ink-muted" : "text-xs text-ink-muted"}>{t.label}</p>
          <p className={cn("font-semibold tabular", print ? "mt-0.5 text-[12px]" : "mt-1 text-lg", t.tone)}>{t.value}</p>
          {t.hint && <p className={cn("mt-0.5 text-ink-muted", print ? "text-[9px]" : "text-[11px]")}>{t.hint}</p>}
        </div>
      ))}
    </div>
  );
}

type Col = { label: string; right?: boolean; className?: string };

function Table({ cols, children, foot, compact }: { cols: Col[]; children: ReactNode; foot?: ReactNode; compact?: boolean }) {
  const print = useContext(PrintMode);
  return (
    <div className={print ? "" : "-mx-5 overflow-x-auto px-5"}>
      <table className={cn("w-full", print ? "text-[10.5px]" : "text-sm", !compact && !print && "min-w-[560px]")}>
        <thead>
          <tr className="border-b border-ink-soft text-left text-xs tracking-wider text-ink-muted uppercase print:text-[9px]">
            {cols.map((c) => (
              <th key={c.label} className={cn("py-2 pr-3 font-medium whitespace-nowrap print:py-1", c.right && "text-right", c.className)}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_tr]:break-inside-avoid print:[&_td]:py-[3px]">
          {children}
        </tbody>
        {foot && <tfoot className="font-semibold [&_td]:py-2 [&_td]:pr-3 print:[&_td]:py-1">{foot}</tfoot>}
      </table>
    </div>
  );
}

/** Çıktı modunda ekran genişliğinden bağımsız sabit düzen. */
function usePrintGrid(printClasses: string, screenClasses: string) {
  return useContext(PrintMode) ? printClasses : screenClasses;
}

const R = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn("text-right whitespace-nowrap tabular", className)}>{children}</td>
);

function EventLink({ id, children }: { id: number; children: ReactNode }) {
  const print = useContext(PrintMode);
  return print ? <>{children}</> : <Link to={`/etkinlikler/${id}?sekme=kapanis`} className="text-brand-700 hover:underline">{children}</Link>;
}

function Overdue({ days }: { days: number }) {
  return days > 0 ? <span className="font-medium text-danger-700">{days} gün gecikti</span> : null;
}

// --- Bölümler ---

function Position({ s }: { s: PeriodSummary }) {
  const p = s.position;
  return (
    <Section
      title="Genel Durum"
      description={`${formatDate(s.as_of)} itibarıyla. Tutarlar TL karşılığıdır (döviz bakiyeler kayıt kurlarıyla).`}
    >
      <Tiles
        items={[
          { label: "Kasa + Banka", value: tl(p.cash_base) },
          { label: "Ortaklardaki şirket parası", value: tl(p.partner_held_base), tone: Number(p.partner_held_base) > 0 ? "text-warning-700" : "" },
          { label: "Müşteri alacakları", value: tl(p.receivables_base) },
          { label: "Sanatçı / tedarikçi borçları", value: tl(p.payables_base), tone: "text-danger-700" },
          { label: "Ödenecek KDV", value: tl(p.vat_payable_base) },
          { label: "Şirketin ortaklara borcu", value: tl(p.owed_to_partners_base) },
        ]}
      />
      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-sm print:mt-2 print:rounded print:border print:border-line print:bg-white print:px-2 print:py-1.5 print:text-[11px]">
        <p className="font-medium text-brand-900">
          Net durum: <span className={cn("tabular", signed(p.net_base))}>{tl(p.net_base)}</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-soft print:text-[9.5px]">
          Kasa + ortaklardaki para + alacaklar − borçlar − KDV − ortaklara borç. Henüz finans kapanışı yapılmamış
          işlerin kârı ve ileri tarihli işlerin bekleyen kısmı bu rakamın içindedir.
        </p>
      </div>
      {s.currencies.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-ink">Döviz pozisyonu (orijinal para birimiyle)</p>
          <Table cols={[{ label: "Para birimi" }, { label: "Kasa / banka", right: true }, { label: "Ortaklarda", right: true }, { label: "Alacak", right: true }, { label: "Borç", right: true }, { label: "Net", right: true }]}>
            {s.currencies.map((c) => (
              <tr key={c.currency}>
                <td className="font-medium">{c.currency}</td>
                <R>{cur(c.cash, c.currency)}</R>
                <R>{cur(c.partner_held, c.currency)}</R>
                <R>{cur(c.receivable, c.currency)}</R>
                <R>{cur(c.payable, c.currency)}</R>
                <R className={cn("font-semibold", signed(c.net))}>{cur(c.net, c.currency)}</R>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </Section>
  );
}

function Profit({ s }: { s: PeriodSummary }) {
  const p = s.profitability;
  const maxExpense = Math.max(1, ...p.expense_categories.map((c) => Number(c.amount_base)));
  return (
    <Section title="Kârlılık" description="Etkinlik sonuçları etkinliğin yapıldığı aya göre; ay sonucu ise kapanışla kesinleşen kâr ve genel giderlerdir.">
      <Tiles
        items={[
          { label: "Etkinlik geliri (KDV hariç)", value: tl(p.revenue), hint: `${p.event_count} etkinlik` },
          { label: "Etkinlik maliyet + gideri", value: tl(p.event_costs) },
          { label: "Etkinlik kârı", value: tl(p.event_profit), hint: p.margin != null ? `Marj %${formatNumber(p.margin)}` : undefined, tone: signed(p.event_profit) },
          { label: "Kapanışla kesinleşen kâr", value: tl(p.realized_profit), hint: "Ortaklara dağıtıldı", tone: signed(p.realized_profit) },
          { label: "Genel giderler", value: tl(p.general_expenses), tone: "text-danger-700" },
          { label: "Ay sonucu", value: tl(p.month_result), tone: signed(p.month_result) },
        ]}
      />

      <p className="mt-6 mb-2 text-sm font-medium text-ink">Ayın etkinlikleri</p>
      <Table
        cols={[{ label: "Tarih" }, { label: "Etkinlik", className: "w-[34%]" }, { label: "Gelir", right: true }, { label: "Maliyet", right: true }, { label: "Kâr", right: true }, { label: "Marj", right: true }, { label: "Durum" }]}
        foot={
          <tr>
            <td colSpan={2}>Toplam</td>
            <R>{tl(p.revenue)}</R>
            <R>{tl(p.event_costs)}</R>
            <R className={signed(p.event_profit)}>{tl(p.event_profit)}</R>
            <R>{pctText(p.margin)}</R>
            <td />
          </tr>
        }
      >
        {s.events.map((e) => (
          <tr key={e.event_id}>
            <td className="whitespace-nowrap">{formatDate(e.event_date, "short")}</td>
            <td>
              <EventLink id={e.event_id}>{e.title}</EventLink>
              <span className="block text-[11px] leading-tight text-ink-muted print:text-[9.5px]">
                {e.customer} · {e.partner}
                {e.currency !== "TRY" && ` · ${cur(e.total_amount, e.currency)}`}
              </span>
            </td>
            <R>{tl(e.revenue)}</R>
            <R>{tl(Number(e.cost) + Number(e.expense) - Number(e.fx))}</R>
            <R className={cn("font-medium", signed(e.profit))}>{tl(e.profit)}</R>
            <R>{pctText(e.margin)}</R>
            <td className="text-xs whitespace-nowrap print:text-[9.5px]">
              {e.closed ? "Kapandı" : EVENT_STATUS[e.status].label}
              {e.status === "completed" && !e.report_submitted && <span className="block text-warning-700">Rapor yok</span>}
            </td>
          </tr>
        ))}
      </Table>

      <div className={cn("mt-6 grid gap-6", usePrintGrid("grid-cols-2", "grid-cols-1 lg:grid-cols-2"))}>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">İşi getiren ortağa göre</p>
          <Table compact cols={[{ label: "Ortak" }, { label: "Etkinlik", right: true }, { label: "Gelir", right: true }, { label: "Kâr", right: true }]}>
            {p.by_partner.map((x) => (
              <tr key={x.partner}>
                <td>{x.partner}</td>
                <R>{x.event_count}</R>
                <R>{tl(x.revenue)}</R>
                <R className={signed(x.profit)}>{tl(x.profit)}</R>
              </tr>
            ))}
          </Table>
          <p className="mt-2 text-xs text-ink-muted">Kâr kimin getirdiğinden bağımsız olarak üç ortağa eşit bölünür.</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Genel gider dağılımı</p>
          <ul className="space-y-2 text-sm print:space-y-1 print:text-[10.5px]">
            {p.expense_categories.map((c) => (
              <li key={c.category}>
                <div className="flex justify-between gap-3">
                  <span>{c.category}</span>
                  <span className="tabular">{tl(c.amount_base)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-canvas print:mt-0.5 print:h-1">
                  <div className="h-full rounded-full bg-accent-500" style={{ width: `${(Number(c.amount_base) / maxExpense) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          {Number(p.event_expenses_base) > 0 && (
            <p className="mt-3 text-xs text-ink-muted">Etkinliklere bağlı giderler ({tl(p.event_expenses_base)}) etkinlik kârından düşülmüştür.</p>
          )}
        </div>
      </div>
    </Section>
  );
}

function Cash({ s }: { s: PeriodSummary }) {
  const totalIn = s.cash_flow.reduce((t, f) => t + Number(f.inflow_base), 0);
  const totalOut = s.cash_flow.reduce((t, f) => t + Number(f.outflow_base), 0);
  return (
    <Section title="Nakit" description="Kasa ve banka hesaplarının ay içindeki hareketi.">
      <Table cols={[{ label: "Hesap" }, { label: "Ay başı", right: true }, { label: "Giren", right: true }, { label: "Çıkan", right: true }, { label: "Ay sonu", right: true }, { label: "TL karşılığı", right: true }]}>
        {s.cash.map((c) => (
          <tr key={c.name}>
            <td className="font-medium">{c.name}</td>
            <R>{cur(c.opening, c.currency)}</R>
            <R className="text-success-700">{cur(c.inflow, c.currency)}</R>
            <R className="text-danger-700">{cur(c.outflow, c.currency)}</R>
            <R className="font-semibold">{cur(c.closing, c.currency)}</R>
            <R>{tl(c.closing_base)}</R>
          </tr>
        ))}
      </Table>
      <p className="mt-6 mb-2 text-sm font-medium text-ink">Hareket türlerine göre (TL karşılığı)</p>
      <Table
        cols={[{ label: "Tür" }, { label: "Giren", right: true }, { label: "Çıkan", right: true }]}
        foot={
          <tr>
            <td>Toplam</td>
            <R>{tl(totalIn)}</R>
            <R>{tl(totalOut)}</R>
          </tr>
        }
      >
        {s.cash_flow.map((f) => (
          <tr key={f.label}>
            <td>{f.label}</td>
            <R>{Number(f.inflow_base) ? tl(f.inflow_base) : ""}</R>
            <R>{Number(f.outflow_base) ? tl(f.outflow_base) : ""}</R>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

function Receivables({ s }: { s: PeriodSummary }) {
  const overdue = s.receivables.filter((r) => r.overdue_days > 0);
  const notDue = s.receivables.filter((r) => r.overdue_days === 0);
  const sum = (rows: typeof overdue) => rows.reduce((t, r) => t + Number(r.remaining_base), 0);
  const rows = (items: typeof overdue) =>
    items.map((r) => (
      <tr key={r.event_id}>
        <td>
          <EventLink id={r.event_id}>{r.title}</EventLink>
          <span className="block text-[11px] leading-tight text-ink-muted print:text-[9.5px]">
            {r.customer.name} · {formatDate(r.event_date, "short")}
          </span>
        </td>
        <R>{cur(r.total, r.currency)}</R>
        <R>{cur(r.collected, r.currency)}</R>
        <R className="font-semibold">{cur(r.remaining, r.currency)}</R>
        <R>{tl(r.remaining_base)}</R>
        <td className="text-xs whitespace-nowrap print:text-[9.5px]">
          {r.due_date ? formatDate(r.due_date, "short") : "—"}
          <span className="block">
            <Overdue days={r.overdue_days} />
          </span>
        </td>
      </tr>
    ));
  const cols: Col[] = [{ label: "Etkinlik / müşteri" }, { label: "Toplam", right: true }, { label: "Tahsil edilen", right: true }, { label: "Kalan", right: true }, { label: "TL karşılığı", right: true }, { label: "Vade" }];
  return (
    <Section title="Müşteri Alacakları" description="Anlaşma tutarından tahsil edilen ve silinen düşülür.">
      <Tiles
        items={[
          { label: "Vadesi geçmiş", value: tl(sum(overdue)), hint: `${overdue.length} kalem`, tone: overdue.length ? "text-danger-700" : "" },
          { label: "Vadesi gelmemiş", value: tl(sum(notDue)), hint: `${notDue.length} kalem (çoğu ileri tarihli işler)` },
          { label: "Toplam", value: tl(sum(s.receivables)) },
        ]}
      />
      {overdue.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-sm font-medium text-danger-700">Vadesi geçmiş</p>
          <Table cols={cols}>{rows(overdue)}</Table>
        </>
      )}
      {notDue.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-sm font-medium text-ink">Vadesi gelmemiş</p>
          <Table cols={cols}>{rows(notDue)}</Table>
        </>
      )}
    </Section>
  );
}

function Payables({ s }: { s: PeriodSummary }) {
  const overdue = s.payables.filter((p) => p.overdue_days > 0);
  const notDue = s.payables.filter((p) => p.overdue_days === 0);
  const sum = (rows: typeof overdue) => rows.reduce((t, r) => t + Number(r.remaining_base), 0);
  const rows = (items: typeof overdue) =>
    items.map((p) => (
      <tr key={p.payable_id}>
        <td>
          {p.payee ?? p.title}
          <span className="block text-[11px] leading-tight text-ink-muted print:text-[9.5px]">
            {p.title !== p.payee ? `${p.title} · ` : ""}
            {p.event ?? "Genel gider"}
          </span>
        </td>
        <R>{cur(p.amount, p.currency)}</R>
        <R>{cur(p.paid, p.currency)}</R>
        <R className="font-semibold">{cur(p.remaining, p.currency)}</R>
        <R>{tl(p.remaining_base)}</R>
        <td className="text-xs whitespace-nowrap print:text-[9.5px]">
          {p.due_date ? formatDate(p.due_date, "short") : "—"}
          <span className="block">
            <Overdue days={p.overdue_days} />
          </span>
        </td>
      </tr>
    ));
  const byPayee = new Map<string, number>();
  for (const p of s.payables) byPayee.set(p.payee ?? p.title, (byPayee.get(p.payee ?? p.title) ?? 0) + Number(p.remaining_base));
  const cols: Col[] = [{ label: "Kime / ne için" }, { label: "Tutar", right: true }, { label: "Ödenen", right: true }, { label: "Kalan", right: true }, { label: "TL karşılığı", right: true }, { label: "Vade" }];
  return (
    <Section title="Sanatçı ve Tedarikçi Borçları" description="Anlaşmalardan ve ödenmemiş giderlerden doğan borçlar.">
      <Tiles
        items={[
          { label: "Vadesi geçmiş", value: tl(sum(overdue)), hint: `${overdue.length} kalem`, tone: overdue.length ? "text-danger-700" : "" },
          { label: "Vadesi gelmemiş", value: tl(sum(notDue)), hint: `${notDue.length} kalem` },
          { label: "Toplam", value: tl(sum(s.payables)) },
        ]}
      />
      {overdue.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-sm font-medium text-danger-700">Vadesi geçmiş</p>
          <Table cols={cols}>{rows(overdue)}</Table>
        </>
      )}
      {notDue.length > 0 && (
        <>
          <p className="mt-5 mb-2 text-sm font-medium text-ink">Vadesi gelmemiş</p>
          <Table cols={cols}>{rows(notDue)}</Table>
        </>
      )}
      <p className="mt-5 mb-2 text-sm font-medium text-ink">Kime ne kadar borçluyuz (TL karşılığı)</p>
      <div className={cn("grid", usePrintGrid("grid-cols-3 gap-x-4 text-[10.5px]", "grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2"))}>
        {[...byPayee.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, total]) => (
            <div key={name} className="flex justify-between gap-2 border-b border-line py-1 print:py-0.5">
              <span>{name}</span>
              <span className="tabular">{tl(total)}</span>
            </div>
          ))}
      </div>
    </Section>
  );
}

/** Türkçe yönelme eki: "Alper'e", "Volkan'a", "İbrahim'e". */
function dative(name: string) {
  const vowels = name.toLocaleLowerCase("tr").match(/[aıoueiöü]/g);
  const last = vowels?.[vowels.length - 1] ?? "e";
  return `${name}'${"aıou".includes(last) ? "a" : "e"}`;
}

function PartnerSentence({ p }: { p: PeriodSummary["partners"][number] }) {
  const held = Object.entries(p.held_by_currency)
    .map(([c, v]) => cur(v, c))
    .join(" + ");
  const net = Number(p.net);
  return (
    <p className="text-sm">
      {Number(p.closing_held) > 0 && (
        <>
          <strong>{p.name}</strong> üzerinde şirkete teslim etmesi gereken <strong>{held}</strong> var
          {" "}({tl(p.closing_held)}).{" "}
        </>
      )}
      {net > 0 ? (
        <>
          Mahsup edildiğinde şirket <strong>{dative(p.name)}</strong> <strong className="text-success-700">{tl(net)}</strong> borçlu.
        </>
      ) : net < 0 ? (
        <>
          Mahsup edildiğinde <strong>{p.name}</strong> şirkete <strong className="text-danger-700">{tl(-net)}</strong> borçlu.
        </>
      ) : (
        <>
          <strong>{p.name}</strong> ile hesap kapalı.
        </>
      )}
    </p>
  );
}

function Partners({ s }: { s: PeriodSummary }) {
  return (
    <Section
      title="Ortakların Şirkete Karşı Durumu"
      description="Üzerindeki para: ortağın elden tahsil edip henüz teslim etmediği şirket parası. Şirketin borcu: kâr/zarar payları ve ortağın cebinden yaptığı ödemeler."
    >
      <div className={cn("grid", usePrintGrid("grid-cols-3 gap-2", "grid-cols-1 gap-4 lg:grid-cols-3"))}>
        {s.partners.map((p) => (
          <div key={p.partner_id} className="rounded-lg border border-line p-4 break-inside-avoid print:rounded print:p-2">
            <p className="font-display text-lg text-ink print:text-[13px]">{p.name}</p>
            <table className="mt-2 w-full text-sm print:mt-1 print:text-[9.5px]">
              <thead>
                <tr className="text-[11px] tracking-wider text-ink-muted uppercase print:text-[8px]">
                  <th className="py-1 text-left font-medium">Hareket</th>
                  <th className="py-1 text-right font-medium">Üzerinde</th>
                  <th className="py-1 text-right font-medium">Şirketin borcu</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-1 print:[&_td]:py-0.5 [&_td+td]:pl-2">
                <tr className="text-ink-muted">
                  <td>Ay başı</td>
                  <R>{tl(p.opening_held)}</R>
                  <R>{tl(p.opening_owed)}</R>
                </tr>
                {p.movements.map((m) => (
                  <tr key={m.label}>
                    <td>{m.label}</td>
                    <R>{Number(m.held) ? tl(m.held) : ""}</R>
                    <R>{Number(m.owed) ? tl(m.owed) : ""}</R>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td>Ay sonu</td>
                  <R className={Number(p.closing_held) > 0 ? "text-warning-700" : ""}>{tl(p.closing_held)}</R>
                  <R>{tl(p.closing_owed)}</R>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 rounded-md bg-surface-muted px-3 py-2 print:mt-1.5 print:bg-white print:p-0 print:text-[9.5px] [&_p]:print:text-[9.5px]">
              <PartnerSentence p={p} />
            </div>
          </div>
        ))}
      </div>
      {s.distribution_preview.length > 0 && s.status === "open" && (
        <p className="mt-4 text-sm text-ink-soft">
          Dönem kapatıldığında genel giderlerin payı ortaklara yazılacak:{" "}
          {s.distribution_preview.map((d) => `${d.name} ${tl(d.share)}`).join(" · ")}
        </p>
      )}
    </Section>
  );
}

export function PeriodSummaryView({ summary, print = false }: { summary: PeriodSummary; print?: boolean }) {
  const s = summary;
  return (
    <PrintMode.Provider value={print}>
      <div className={print ? "text-[11px] leading-snug [&_p.text-sm]:text-[11px]" : "space-y-6"}>
        {s.warnings.length > 0 && (
          <ul className="space-y-1.5 rounded-lg border border-warning-600/20 bg-warning-50 px-4 py-3 text-sm text-warning-700 print:space-y-0.5 print:rounded print:bg-white print:px-3 print:py-2 print:text-[10.5px]">
            {s.warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        )}
        <Position s={s} />
        <Profit s={s} />
        <Partners s={s} />
        <Receivables s={s} />
        <Payables s={s} />
        <Cash s={s} />
        {s.upcoming_events > 0 && (
          <p className={cn("text-sm text-ink-soft", print && "mt-6")}>
            İleri tarihli {s.upcoming_events} etkinlik var; bunlar için alınan kapora ve avanslar:{" "}
            <strong>{tl(s.upcoming_advances_base)}</strong>.
          </p>
        )}
      </div>
    </PrintMode.Provider>
  );
}
