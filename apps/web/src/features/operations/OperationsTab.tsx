import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  useDeleteTask,
  useEventOperations,
  useSaveReport,
  useSyncRiders,
  useUpdateRiderCheck,
  useUpdateTask,
  type EventOperations,
  type RiderCheck,
  type RiderStatus,
  type Task,
} from "@/features/operations/api";
import { RiderCheckDialog } from "@/features/operations/RiderCheckDialog";
import { TaskDialog } from "@/features/operations/TaskDialog";
import { PrintLink } from "@/features/print/PrintLink";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatDateTime, todayISO } from "@/shared/lib/format";
import { RIDER_CATEGORY_LABELS, RIDER_STATUS, TASK_CATEGORY_LABELS } from "@/shared/lib/labels";
import { optionalText } from "@/shared/lib/validation";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Input,
  LoadingState,
  ProgressBar,
  ReasonDialog,
  Textarea,
  toast,
} from "@/shared/ui";

const hhmm = (v: string | null) => (v ? v.slice(0, 5) : null);

function Summary({ ops }: { ops: EventOperations }) {
  const p = ops.progress;
  const report = { none: "Henüz yazılmadı", draft: "Taslak", submitted: "Teslim edildi" }[p.report];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm text-ink-muted">Görevler</p>
          <p className="font-display text-2xl text-ink">
            {p.tasks_done} <span className="text-base text-ink-muted">/ {p.tasks_total}</span>
          </p>
          <ProgressBar value={p.tasks_done} max={p.tasks_total} label="Tamamlanan görevler" />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm text-ink-muted">Rider kontrolü</p>
          <p className="font-display text-2xl text-ink">
            {p.riders_ok} <span className="text-base text-ink-muted">/ {p.riders_total}</span>
          </p>
          <ProgressBar
            value={p.riders_ok}
            max={p.riders_total}
            label="Karşılanan rider şartları"
            tone={p.rider_problems > 0 ? "danger" : undefined}
          />
          {p.rider_problems > 0 && <p className="text-xs font-medium text-danger-700">{p.rider_problems} şartta sorun var</p>}
        </CardBody>
      </Card>
      <Card>
        <CardBody className="space-y-2">
          <p className="text-sm text-ink-muted">Operasyon raporu</p>
          <p className="font-display text-2xl text-ink">{report}</p>
          <ProgressBar value={p.report === "submitted" ? 1 : 0} max={1} label="Operasyon raporu" />
        </CardBody>
      </Card>
    </div>
  );
}

function TaskRow({ task, ops, onEdit, onDelete }: { task: Task; ops: EventOperations; onEdit: () => void; onDelete: () => void }) {
  const update = useUpdateTask(ops.event_id);
  const done = task.status === "done";
  const toggle = () =>
    update.mutate(
      { id: task.id, body: { status: done ? "todo" : "done" } },
      { onError: (e) => toast.error(e.message) },
    );
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <button
        type="button"
        onClick={toggle}
        disabled={!ops.can_manage || update.isPending}
        aria-pressed={done}
        aria-label={`${task.title}: ${done ? "tamamlanmadı olarak işaretle" : "tamamlandı olarak işaretle"}`}
        className={cn(
          "-m-1.5 grid size-9 shrink-0 place-items-center rounded-full transition-colors",
          ops.can_manage && "hover:bg-canvas",
          done ? "text-success-600" : "text-ink-faint",
        )}
      >
        {done ? <CheckCircle2 className="size-6" /> : <Circle className="size-6" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done ? "text-ink-muted line-through" : "text-ink")}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <Badge dot={false}>{TASK_CATEGORY_LABELS[task.category]}</Badge>
          {task.due_date && (
            <span className={cn(task.is_overdue && "font-medium text-danger-700")}>
              {task.is_overdue ? "Gecikti · " : ""}
              {formatDate(task.due_date, "short")}
              {task.due_time ? ` ${hhmm(task.due_time)}` : ""}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" aria-hidden /> {task.assigned_to?.name ?? "Atanmadı"}
          </span>
          {done && task.completed_by && task.completed_at && (
            <span>
              {task.completed_by} · {formatDateTime(task.completed_at)}
            </span>
          )}
        </div>
        {task.description && <p className="mt-1 text-sm text-ink-soft">{task.description}</p>}
        {task.note && <p className="mt-1 text-sm text-ink-soft">Not: {task.note}</p>}
      </div>
      {ops.can_manage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`${task.title} işlemleri`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem icon={<Pencil />} onSelect={onEdit}>
              Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={onDelete}>
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function Tasks({ ops }: { ops: EventOperations }) {
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const remove = useDeleteTask(ops.event_id);
  return (
    <Card>
      <CardHeader
        title="Görevler"
        description="Anlaşmada standart liste açılır; dokunarak tamamlayın."
        actions={
          ops.can_manage && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
              <Plus /> Görev Ekle
            </Button>
          )
        }
      />
      {ops.tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Görev yok" />
      ) : (
        <ul className="divide-y divide-line">
          {ops.tasks.map((task) => (
            <TaskRow key={task.id} task={task} ops={ops} onEdit={() => setEditing(task)} onDelete={() => setDeleting(task)} />
          ))}
        </ul>
      )}
      <TaskDialog ops={ops} open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} task={editing} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Görev Silinecek"
        description={deleting?.title ?? ""}
        confirmLabel="Sil"
        tone="danger"
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Görev silindi.");
              setDeleting(null);
            },
            onError: (e) => toast.error(e.message),
          })
        }
      />
    </Card>
  );
}

const RIDER_CHOICES: { status: RiderStatus; label: string; active: string }[] = [
  { status: "ok", label: "Tamam", active: "bg-success-600 text-white ring-success-600" },
  { status: "problem", label: "Sorun var", active: "bg-danger-600 text-white ring-danger-600" },
  { status: "not_needed", label: "Gerekmiyor", active: "bg-info-600 text-white ring-info-600" },
];

function RiderRow({ check, ops, onProblem }: { check: RiderCheck; ops: EventOperations; onProblem: () => void }) {
  const update = useUpdateRiderCheck(ops.event_id);
  const choose = (status: RiderStatus) => {
    if (status === "problem") return onProblem();
    // Seçili duruma tekrar dokunmak kontrolü geri alır.
    const next = check.status === status ? "pending" : status;
    update.mutate({ id: check.id, status: next }, { onError: (e) => toast.error(e.message) });
  };
  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {check.title}
            {!check.is_required && <span className="ml-2 text-xs font-normal text-ink-muted">(isteğe bağlı)</span>}
          </p>
          <p className="text-xs text-ink-muted">{RIDER_CATEGORY_LABELS[check.category]}</p>
          {check.description && <p className="mt-1 text-sm text-ink-soft">{check.description}</p>}
        </div>
        {!ops.can_manage && <Badge tone={RIDER_STATUS[check.status].tone}>{RIDER_STATUS[check.status].label}</Badge>}
      </div>
      {ops.can_manage && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${check.title} durumu`}>
          {RIDER_CHOICES.map((c) => {
            const active = check.status === c.status;
            return (
              <button
                key={c.status}
                type="button"
                aria-pressed={active}
                disabled={update.isPending}
                onClick={() => choose(c.status)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium ring-1 transition-colors ring-inset",
                  active ? c.active : "bg-surface text-ink-soft ring-line-strong hover:bg-canvas",
                )}
              >
                {active && <Check className="size-4" aria-hidden />}
                {c.label}
              </button>
            );
          })}
        </div>
      )}
      {check.status === "problem" && check.note && (
        <p className="flex gap-2 rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {check.note}
        </p>
      )}
      {check.checked_by && check.checked_at && check.status !== "pending" && (
        <p className="text-xs text-ink-muted">
          {check.checked_by} · {formatDateTime(check.checked_at)}
        </p>
      )}
    </li>
  );
}

function Riders({ ops }: { ops: EventOperations }) {
  const [problem, setProblem] = useState<RiderCheck | null>(null);
  const [adding, setAdding] = useState(false);
  const update = useUpdateRiderCheck(ops.event_id);
  const sync = useSyncRiders(ops.event_id);
  const groups = new Map<string, RiderCheck[]>();
  for (const check of ops.rider_checks) {
    const key = check.artist?.name ?? "Etkinliğe özel";
    groups.set(key, [...(groups.get(key) ?? []), check]);
  }
  return (
    <Card>
      <CardHeader
        title="Rider / Kulis Kontrolü"
        description="Sanatçıların katalogdaki şartları otomatik kopyalanır."
        actions={
          ops.can_manage && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                loading={sync.isPending}
                onClick={() => sync.mutate(undefined, { onSuccess: () => toast.success("Katalogdaki yeni şartlar eklendi."), onError: (e) => toast.error(e.message) })}
              >
                <RefreshCw /> Katalogdan güncelle
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
                <Plus /> Şart Ekle
              </Button>
            </div>
          )
        }
      />
      {ops.rider_checks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Rider şartı yok" description="Programdaki sanatçıların katalogda rider şartı tanımlı değil." />
      ) : (
        [...groups.entries()].map(([artist, checks]) => (
          <section key={artist} aria-label={artist}>
            <h3 className="border-t border-line bg-surface-muted px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase first:border-t-0">
              {artist}
            </h3>
            <ul className="divide-y divide-line">
              {checks.map((check) => (
                <RiderRow key={check.id} check={check} ops={ops} onProblem={() => setProblem(check)} />
              ))}
            </ul>
          </section>
        ))
      )}
      <ReasonDialog
        open={problem !== null}
        onOpenChange={(o) => {
          if (!o) {
            update.reset();
            setProblem(null);
          }
        }}
        title="Sorunu Kaydet"
        description={problem?.title ?? ""}
        confirmLabel="Sorunu Kaydet"
        loading={update.isPending}
        error={update.error}
        onConfirm={(note) =>
          problem &&
          update.mutate(
            { id: problem.id, status: "problem", note },
            {
              onSuccess: () => {
                toast.success("Sorun kaydedildi.");
                setProblem(null);
              },
            },
          )
        }
      />
      <RiderCheckDialog eventId={ops.event_id} open={adding} onOpenChange={setAdding} />
    </Card>
  );
}

const reportSchema = z.object({
  actual_guest_count: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,6}$/.test(v), "Sayı girin.")
    .transform((v) => (v === "" ? null : Number(v))),
  went_well: optionalText(4000),
  issues: optionalText(4000),
  notes: optionalText(4000),
});

type ReportInput = z.input<typeof reportSchema>;
type ReportOutput = z.output<typeof reportSchema>;

function Report({ ops, eventDate }: { ops: EventOperations; eventDate: string }) {
  const save = useSaveReport(ops.event_id);
  const r = ops.report;
  const submitted = r?.status === "submitted";
  const canSubmit = eventDate <= todayISO();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportInput, unknown, ReportOutput>({ resolver: zodResolver(reportSchema) });

  useEffect(() => {
    reset({
      actual_guest_count: r?.actual_guest_count != null ? String(r.actual_guest_count) : "",
      went_well: r?.went_well ?? "",
      issues: r?.issues ?? "",
      notes: r?.notes ?? "",
    });
  }, [r, reset]);

  const submit = (send: boolean) =>
    handleSubmit((values) =>
      save.mutate(
        { ...values, submit: send },
        { onSuccess: () => toast.success(send ? "Operasyon raporu teslim edildi." : "Rapor taslağı kaydedildi.") },
      ),
    )();

  return (
    <Card>
      <CardHeader
        title="Operasyon Raporu"
        description="Etkinlik sonrası ekip tarafından yazılır; finans kapanışında kontrol edilir."
        actions={submitted ? <Badge tone="success">Teslim edildi</Badge> : r ? <Badge tone="warning">Taslak</Badge> : null}
      />
      <CardBody>
        {submitted && r?.submitted_by && r.submitted_at && (
          <p className="mb-4 text-sm text-ink-muted">
            {r.submitted_by} · {formatDateTime(r.submitted_at)}
          </p>
        )}
        <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4" noValidate>
          <fieldset disabled={!ops.can_manage} className="contents">
            <Field label="Gerçekleşen kişi sayısı" error={errors.actual_guest_count?.message}>
              {(p) => <Input {...p} {...register("actual_guest_count")} inputMode="numeric" className="sm:max-w-48" />}
            </Field>
            <Field label="İyi gidenler">{(p) => <Textarea {...p} {...register("went_well")} />}</Field>
            <Field label="Yaşanan sorunlar">{(p) => <Textarea {...p} {...register("issues")} />}</Field>
            <Field label="Diğer notlar">{(p) => <Textarea {...p} {...register("notes")} />}</Field>
          </fieldset>
          <FormError error={save.error} />
          {ops.can_manage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" loading={save.isPending && !save.variables?.submit} onClick={() => submit(false)}>
                Kaydet
              </Button>
              {!submitted && (
                <Button loading={save.isPending && save.variables?.submit} disabled={!canSubmit} onClick={() => submit(true)}>
                  <Send /> Raporu Teslim Et
                </Button>
              )}
              {!canSubmit && <span className="text-sm text-ink-muted">Etkinlik gününden itibaren teslim edilebilir.</span>}
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

export function OperationsTab({ eventId, eventDate }: { eventId: number; eventDate: string }) {
  const ops = useEventOperations(eventId);
  if (ops.isPending) return <LoadingState />;
  if (ops.isError) return <ErrorState error={ops.error} />;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <PrintLink to={`/yazdir/etkinlik/${eventId}`} label="Operasyon föyü" />
      </div>
      <Summary ops={ops.data} />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Tasks ops={ops.data} />
        <div className="space-y-6">
          <Riders ops={ops.data} />
          <Report ops={ops.data} eventDate={eventDate} />
        </div>
      </div>
    </div>
  );
}
