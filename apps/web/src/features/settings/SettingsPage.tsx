import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api, type Schema } from "@/shared/api/client";
import { optionalEmail, optionalText, requiredText } from "@/shared/lib/validation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  FormError,
  Input,
  Select,
  LoadingState,
  PageHeader,
  Textarea,
  toast,
} from "@/shared/ui";

type CompanySettings = Schema<"CompanySettingsRead">;

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const schema = z.object({
  company_name: requiredText(2, 160, "Firma adı"),
  legal_name: optionalText(200),
  phone: optionalText(40),
  email: optionalEmail,
  website: optionalText(160),
  address: optionalText(4000),
  tax_office: optionalText(80),
  tax_number: optionalText(40),
  iban: optionalText(40),
  default_vat_rate: z
    .string()
    .refine((v) => /^\d{1,3}([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) <= 100, "0 ile 100 arasında oran girin.")
    .transform((v) => v.replace(",", ".")),
  offer_validity_days: z.coerce.number<string>().int("Tam sayı girin.").min(1, "En az 1 gün.").max(365, "En fazla 365 gün."),
  season_start_month: z.coerce.number<string>().int().min(1).max(12),
  default_payment_terms: optionalText(4000),
  offer_footer_note: optionalText(4000),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings", "company"], queryFn: () => api<CompanySettings>("/settings/company") });
  const save = useMutation({
    mutationFn: (body: FormOutput) => api<CompanySettings>("/settings/company", { method: "PATCH", body }),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "company"], data);
      toast.success("Ayarlar kaydedildi.");
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data;
    reset({
      company_name: s.company_name,
      legal_name: s.legal_name ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      website: s.website ?? "",
      address: s.address ?? "",
      tax_office: s.tax_office ?? "",
      tax_number: s.tax_number ?? "",
      iban: s.iban ?? "",
      default_vat_rate: String(Number(s.default_vat_rate)),
      offer_validity_days: String(s.offer_validity_days),
      season_start_month: String(s.season_start_month),
      default_payment_terms: s.default_payment_terms ?? "",
      offer_footer_note: s.offer_footer_note ?? "",
    });
  }, [settings.data, reset]);

  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState error={settings.error} />;

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="Ayarlar"
        description="Firma bilgileri teklif çıktılarında görünür; varsayılanlar yeni tekliflerde kullanılır."
        actions={
          <Button type="submit" form="settings-form" loading={save.isPending} disabled={!isDirty}>
            <Save /> Kaydet
          </Button>
        }
      />
      <form id="settings-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="grid grid-cols-1 gap-6 lg:grid-cols-2" noValidate>
        <Card>
          <CardHeader title="Firma Bilgileri" description="Teklif çıktısının üst kısmında görünür." />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Firma adı" required error={errors.company_name?.message}>
              {(p) => <Input {...p} {...register("company_name")} />}
            </Field>
            <Field label="Ticari unvan">{(p) => <Input {...p} {...register("legal_name")} />}</Field>
            <Field label="Telefon">{(p) => <Input {...p} {...register("phone")} type="tel" />}</Field>
            <Field label="E-posta" error={errors.email?.message}>
              {(p) => <Input {...p} {...register("email")} type="email" />}
            </Field>
            <Field label="Web sitesi" className="sm:col-span-2">
              {(p) => <Input {...p} {...register("website")} />}
            </Field>
            <Field label="Adres" className="sm:col-span-2">
              {(p) => <Textarea {...p} {...register("address")} className="min-h-16" />}
            </Field>
            <Field label="Vergi dairesi">{(p) => <Input {...p} {...register("tax_office")} />}</Field>
            <Field label="Vergi no">{(p) => <Input {...p} {...register("tax_number")} />}</Field>
            <Field label="IBAN" hint="Teklifte ödeme şartlarının altında görünür" className="sm:col-span-2">
              {(p) => <Input {...p} {...register("iban")} autoComplete="off" />}
            </Field>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Teklif Varsayılanları" />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Varsayılan KDV oranı (%)" hint="KKTC standart oran: %16" error={errors.default_vat_rate?.message}>
              {(p) => <Input {...p} {...register("default_vat_rate")} inputMode="decimal" />}
            </Field>
            <Field label="Teklif geçerlilik süresi (gün)" error={errors.offer_validity_days?.message}>
              {(p) => <Input {...p} {...register("offer_validity_days")} inputMode="numeric" />}
            </Field>
            <Field label="Sezon başlangıç ayı" hint="Sezon 12 ay sürer; 'tüm sezona ait' giderler bu aylara bölünür.">
              {(p) => (
                <Select {...p} {...register("season_start_month")}>
                  {MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Varsayılan ödeme şartları" className="sm:col-span-2">
              {(p) => <Textarea {...p} {...register("default_payment_terms")} />}
            </Field>
            <Field label="Teklif alt notu" hint="Çıktının en altında küçük yazıyla görünür" className="sm:col-span-2">
              {(p) => <Textarea {...p} {...register("offer_footer_note")} className="min-h-16" />}
            </Field>
            <FormError error={save.error} />
          </CardBody>
        </Card>
      </form>
    </>
  );
}
