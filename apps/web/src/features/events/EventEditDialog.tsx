import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCustomer, type Venue } from "@/features/customers/api";
import { useUpdateEvent, type EventDetail } from "@/features/events/api";
import { api, type Page } from "@/shared/api/client";
import { optionalId, optionalText } from "@/shared/lib/validation";
import { Button, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z
  .object({
    event_date: z.string().min(1, "Etkinlik tarihi zorunludur."),
    start_time: z.string(),
    end_time: z.string(),
    venue_id: optionalId,
    contact_id: optionalId,
    guest_count: z
      .string()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), "Pozitif bir sayı girin.")
      .transform((v) => (v === "" ? null : Number(v))),
    notes: optionalText(4000),
  })
  .refine((v) => Boolean(v.start_time) === Boolean(v.end_time), {
    path: ["end_time"],
    message: "Başlangıç ve bitiş saatini birlikte girin.",
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");

export function EventEditDialog({ event, open, onOpenChange }: { event: EventDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateEvent(event.id);
  const customer = useCustomer(open ? event.customer.id : 0);
  const venues = useQuery({
    queryKey: ["venues", "options"],
    queryFn: () => api<Page<Venue>>("/venues", { query: { limit: 200 } }),
    select: (page) => page.items,
    enabled: open,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      event_date: event.event_date,
      start_time: hhmm(event.start_time),
      end_time: hhmm(event.end_time),
      venue_id: event.venue ? String(event.venue.id) : "",
      contact_id: event.contact ? String(event.contact.id) : "",
      guest_count: event.guest_count?.toString() ?? "",
      notes: event.notes ?? "",
    });
  }, [open, event, reset]);

  const close = (next: boolean) => {
    if (!next) update.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((v) =>
    update.mutate(
      { ...v, start_time: v.start_time || null, end_time: v.end_time || null },
      {
        onSuccess: () => {
          toast.success("Etkinlik güncellendi.");
          close(false);
        },
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Etkinliği Düzenle"
      description="Anlaşma tutarları burada değişmez; sadece operasyon bilgileri."
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="event-form" loading={update.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Etkinlik tarihi" required error={errors.event_date?.message}>
          {(p) => <Input {...p} {...register("event_date")} type="date" />}
        </Field>
        <Field label="Kişi sayısı" error={errors.guest_count?.message}>
          {(p) => <Input {...p} {...register("guest_count")} inputMode="numeric" />}
        </Field>
        <Field label="Başlangıç saati">{(p) => <Input {...p} {...register("start_time")} type="time" />}</Field>
        <Field label="Bitiş saati" error={errors.end_time?.message}>
          {(p) => <Input {...p} {...register("end_time")} type="time" />}
        </Field>
        <Field label="Mekân" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("venue_id")}>
              <option value="">Belirtilmedi</option>
              {venues.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Müşteri yetkilisi" className="sm:col-span-2">
          {(p) => (
            <Select {...p} {...register("contact_id")}>
              <option value="">Belirtilmedi</option>
              {customer.data?.contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} />}
        </Field>
        <FormError error={update.error} />
      </form>
    </Dialog>
  );
}
