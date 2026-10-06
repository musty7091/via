import { useParams } from "react-router";

import { useEvent } from "@/features/events/api";
import { useEventOperations } from "@/features/operations/api";
import { PrintLayout, PrintSection, PrintTable } from "@/features/print/PrintLayout";
import { formatDate, formatNumber } from "@/shared/lib/format";
import { PROGRAM_SECTION_LABELS, RIDER_CATEGORY_LABELS, RIDER_STATUS, TASK_CATEGORY_LABELS } from "@/shared/lib/labels";

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");
const range = (start?: string | null, end?: string | null) => (start ? `${hhmm(start)}${end ? ` – ${hhmm(end)}` : ""}` : "");

/** Kutucuk: kâğıt üzerinde işaretlenebilir; tamamlananlar dolu gösterilir. */
function Box({ checked }: { checked: boolean }) {
  return (
    <span className="inline-grid size-3.5 place-items-center rounded-[3px] border border-ink-soft align-middle text-[10px] leading-none">
      {checked ? "✓" : ""}
    </span>
  );
}

/**
 * Etkinlik operasyon föyü: etkinlik günü ekibin elinde olacak tek belge.
 * Tutar içermez; operasyon rolü de yazdırabilir.
 */
export function EventSheetPrintPage() {
  const id = Number(useParams().id);
  const event = useEvent(id);
  const ops = useEventOperations(id);
  const e = event.data;
  const o = ops.data;
  const top = e?.items.filter((i) => !i.parent_id) ?? [];
  const children = (parentId: number) => e?.items.filter((i) => i.parent_id === parentId) ?? [];

  return (
    <PrintLayout
      kind="OPERASYON FÖYÜ"
      title={e?.title ?? ""}
      meta={
        e
          ? [
              ["Etkinlik no", e.event_no],
              ["Tarih", formatDate(e.event_date)],
              ["Saat", range(e.start_time, e.end_time) || "—"],
            ]
          : []
      }
      loading={event.isPending || ops.isPending}
      error={event.error ?? ops.error}
    >
      {e && o && (
        <>
          <section className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-md border border-line p-4">
              <p className="text-xs tracking-wider text-ink-muted uppercase">Müşteri</p>
              <p className="mt-1 font-medium">{e.customer.name}</p>
              {e.contact && (
                <p>
                  {e.contact.name}
                  {e.contact_phone ? ` · ${e.contact_phone}` : ""}
                </p>
              )}
              {e.guest_count && <p className="text-ink-soft">{formatNumber(e.guest_count)} kişi</p>}
            </div>
            <div className="rounded-md border border-line p-4">
              <p className="text-xs tracking-wider text-ink-muted uppercase">Mekân</p>
              <p className="mt-1 font-medium">{e.venue?.name ?? "Belirtilmedi"}</p>
              <p className="text-ink-soft">Sorumlu ortak: {e.partner.name}</p>
            </div>
          </section>
          {e.notes && (
            <p className="mt-4 rounded-md border border-warning-600/30 bg-warning-50 p-3 text-sm print:bg-white">
              <strong>Not:</strong> {e.notes}
            </p>
          )}

          <PrintSection title="Program">
            <PrintTable head={[{ label: "Saat" }, { label: "Bölüm" }, { label: "Program / hizmet" }, { label: "Adet", align: "right" }]}>
              {top.flatMap((item) => [
                <tr key={item.id}>
                  <td className="whitespace-nowrap">{range(item.start_time, item.end_time)}</td>
                  <td>{item.program_section ? PROGRAM_SECTION_LABELS[item.program_section] : ""}</td>
                  <td className="font-medium">{item.title}</td>
                  <td className="text-right">{formatNumber(item.quantity)}</td>
                </tr>,
                ...children(item.id).map((child) => (
                  <tr key={child.id} className="text-ink-soft">
                    <td className="whitespace-nowrap">{range(child.start_time, child.end_time)}</td>
                    <td>{child.program_section ? PROGRAM_SECTION_LABELS[child.program_section] : ""}</td>
                    <td className="pl-4">↳ {child.title}</td>
                    <td className="text-right">{formatNumber(child.quantity)}</td>
                  </tr>
                )),
              ])}
            </PrintTable>
          </PrintSection>

          <PrintSection title={`Görevler (${o.progress.tasks_done}/${o.progress.tasks_total})`}>
            <PrintTable head={[{ label: "" }, { label: "Görev" }, { label: "Tür" }, { label: "Sorumlu" }, { label: "Son tarih" }]}>
              {o.tasks.map((t) => (
                <tr key={t.id}>
                  <td className="w-6">
                    <Box checked={t.status === "done"} />
                  </td>
                  <td>
                    {t.title}
                    {t.note && <span className="block text-[11px] text-ink-muted">{t.note}</span>}
                  </td>
                  <td className="text-ink-soft">{TASK_CATEGORY_LABELS[t.category]}</td>
                  <td>{t.assigned_to?.name ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    {t.due_date ? formatDate(t.due_date, "short") : ""} {hhmm(t.due_time)}
                  </td>
                </tr>
              ))}
            </PrintTable>
          </PrintSection>

          {o.rider_checks.length > 0 && (
            <PrintSection title="Rider / Kulis">
              <PrintTable head={[{ label: "" }, { label: "Şart" }, { label: "Sanatçı" }, { label: "Tür" }, { label: "Durum" }]}>
                {o.rider_checks.map((c) => (
                  <tr key={c.id}>
                    <td className="w-6">
                      <Box checked={c.status === "ok" || c.status === "not_needed"} />
                    </td>
                    <td>
                      {c.title}
                      {c.note && <span className="block text-[11px] text-danger-700">{c.note}</span>}
                    </td>
                    <td>{c.artist?.name ?? "Etkinliğe özel"}</td>
                    <td className="text-ink-soft">{RIDER_CATEGORY_LABELS[c.category]}</td>
                    <td>{RIDER_STATUS[c.status].label}</td>
                  </tr>
                ))}
              </PrintTable>
            </PrintSection>
          )}

          <PrintSection title="Etkinlik sonu notları">
            <div className="space-y-6 text-sm text-ink-muted">
              <p>Gerçekleşen kişi sayısı: ______________</p>
              <p>Yaşanan sorunlar: ____________________________________________________________</p>
              <p>__________________________________________________________________________</p>
            </div>
          </PrintSection>
        </>
      )}
    </PrintLayout>
  );
}
