import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateTask, useUpdateTask, type EventOperations, type Task } from "@/features/operations/api";
import { taskCategoryOptions } from "@/shared/lib/labels";
import { optionalDate, optionalId, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, FormError, Input, Select, Textarea, toast } from "@/shared/ui";

const schema = z.object({
  title: requiredText(2, 200, "Görev"),
  category: z.enum(["setup", "technical", "artist", "hospitality", "transport", "teardown", "other"]),
  assigned_to_id: optionalId,
  due_date: optionalDate,
  due_time: z.string().transform((v) => (v === "" ? null : v)),
  description: optionalText(4000),
  is_required: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface Props {
  ops: EventOperations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}

export function TaskDialog({ ops, open, onOpenChange, task }: Props) {
  const create = useCreateTask(ops.event_id);
  const update = useUpdateTask(ops.event_id);
  const mutation = task ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      title: task?.title ?? "",
      category: task?.category ?? "other",
      assigned_to_id: task?.assigned_to ? String(task.assigned_to.id) : "",
      due_date: task?.due_date ?? "",
      due_time: task?.due_time?.slice(0, 5) ?? "",
      description: task?.description ?? "",
      is_required: task?.is_required ?? true,
    });
  }, [open, task, reset]);

  const close = (next: boolean) => {
    if (!next) {
      create.reset();
      update.reset();
    }
    onOpenChange(next);
  };

  const onSuccess = () => {
    toast.success(task ? "Görev güncellendi." : "Görev eklendi.");
    close(false);
  };
  const onSubmit = handleSubmit((values) =>
    task ? update.mutate({ id: task.id, body: values }, { onSuccess }) : create.mutate(values, { onSuccess }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={task ? "Görevi Düzenle" : "Görev Ekle"}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="task-form" loading={mutation.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Görev" required error={errors.title?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("title")} placeholder="Ör. Jeneratör kiralama teyidi" />}
        </Field>
        <Field label="Kategori">
          {(p) => (
            <Select {...p} {...register("category")}>
              {taskCategoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Sorumlu">
          {(p) => (
            <Select {...p} {...register("assigned_to_id")}>
              <option value="">Atanmadı</option>
              {ops.assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Son tarih">{(p) => <Input {...p} type="date" {...register("due_date")} />}</Field>
        <Field label="Saat">{(p) => <Input {...p} type="time" {...register("due_time")} />}</Field>
        <Field label="Açıklama" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("description")} />}
        </Field>
        <Checkbox {...register("is_required")} label="Zorunlu görev" className="sm:col-span-2" />
        <FormError error={mutation.error} />
      </form>
    </Dialog>
  );
}
