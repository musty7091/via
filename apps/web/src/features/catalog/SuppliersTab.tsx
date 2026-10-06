import { zodResolver } from "@hookform/resolvers/zod";
import { Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { useCan } from "@/features/auth/auth";
import { useSaveCatalog, type Supplier, type SupplierCreate, type SupplierUpdate } from "@/features/catalog/api";
import { CatalogList } from "@/features/catalog/CatalogList";
import { optionalEmail, optionalText, requiredText } from "@/shared/lib/validation";
import { Button, Checkbox, Dialog, Field, FormError, Input, Textarea, toast, type Column } from "@/shared/ui";

const schema = z.object({
  name: requiredText(2, 160, "Firma adı"),
  contact_name: optionalText(120),
  phone: optionalText(40),
  email: optionalEmail,
  tax_number: optionalText(40),
  iban: optionalText(40),
  notes: optionalText(4000),
  is_active: z.boolean(),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}) {
  const save = useSaveCatalog<SupplierCreate | SupplierUpdate, Supplier>("suppliers");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    reset({
      name: supplier?.name ?? "",
      contact_name: supplier?.contact_name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      tax_number: supplier?.tax_number ?? "",
      iban: supplier?.iban ?? "",
      notes: supplier?.notes ?? "",
      is_active: supplier?.is_active ?? true,
    });
  }, [open, supplier, reset]);

  const close = (next: boolean) => {
    if (!next) save.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(({ is_active, ...values }) =>
    save.mutate(
      { id: supplier?.id, body: supplier ? { ...values, is_active } : values },
      {
        onSuccess: () => {
          toast.success(supplier ? "Tedarikçi güncellendi." : "Tedarikçi eklendi.");
          close(false);
        },
      },
    ),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={supplier ? "Tedarikçiyi Düzenle" : "Yeni Tedarikçi"}
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Vazgeç
          </Button>
          <Button type="submit" form="supplier-form" loading={save.isPending}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Firma adı" required error={errors.name?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register("name")} />}
        </Field>
        <Field label="Yetkili">{(p) => <Input {...p} {...register("contact_name")} />}</Field>
        <Field label="Telefon">{(p) => <Input {...p} {...register("phone")} type="tel" />}</Field>
        <Field label="E-posta" error={errors.email?.message}>
          {(p) => <Input {...p} {...register("email")} type="email" />}
        </Field>
        <Field label="Vergi no">{(p) => <Input {...p} {...register("tax_number")} />}</Field>
        <Field label="IBAN" className="sm:col-span-2">
          {(p) => <Input {...p} {...register("iban")} autoComplete="off" />}
        </Field>
        <Field label="Not" className="sm:col-span-2">
          {(p) => <Textarea {...p} {...register("notes")} />}
        </Field>
        {supplier && <Checkbox {...register("is_active")} label="Aktif" className="sm:col-span-2" />}
        <FormError error={save.error} />
      </form>
    </Dialog>
  );
}

const columns: Column<Supplier>[] = [
  { key: "name", header: "Firma", cell: (s) => <span className="font-medium text-ink">{s.name}</span> },
  { key: "contact", header: "Yetkili", cell: (s) => s.contact_name ?? <span className="text-ink-faint">—</span> },
  { key: "phone", header: "Telefon", cell: (s) => s.phone ?? <span className="text-ink-faint">—</span> },
  {
    key: "iban",
    header: "IBAN",
    hideOnMobile: true,
    cell: (s) => (s.iban ? <span className="font-mono text-xs">{s.iban}</span> : <span className="text-ink-faint">—</span>),
  },
];

export function SuppliersTab() {
  const can = useCan();
  const canManage = can("catalog.manage");
  const [form, setForm] = useState<Supplier | null | undefined>(undefined);
  const navigate = useNavigate();
  return (
    <>
      <CatalogList<Supplier>
        resource="suppliers"
        columns={columns}
        searchPlaceholder="Firma, yetkili veya vergi no"
        emptyIcon={Truck}
        emptyTitle="Tedarikçi bulunamadı"
        createLabel="Yeni Tedarikçi"
        onCreate={canManage ? () => setForm(null) : undefined}
        onRowClick={(s) => navigate(`/katalog/tedarikciler/${s.id}`)}
      />
      <SupplierFormDialog open={form !== undefined} onOpenChange={(open) => !open && setForm(undefined)} supplier={form} />
    </>
  );
}
