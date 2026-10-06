import { CalendarDays, Inbox, Plus, Save, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CURRENCIES } from "@/shared/lib/format";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Logo,
  Money,
  PageHeader,
  Select,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@/shared/ui";

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}

const swatches = [
  { name: "Marka lacivert", className: "bg-brand-900", code: "brand-900" },
  { name: "Lacivert 700", className: "bg-brand-700", code: "brand-700" },
  { name: "Lacivert 500", className: "bg-brand-500", code: "brand-500" },
  { name: "Lacivert 100", className: "bg-brand-100", code: "brand-100" },
  { name: "Şampanya", className: "bg-accent-500", code: "accent-500" },
  { name: "Zemin", className: "bg-canvas border border-line", code: "canvas" },
  { name: "Başarılı", className: "bg-success-600", code: "success" },
  { name: "Uyarı", className: "bg-warning-600", code: "warning" },
  { name: "Tehlike", className: "bg-danger-600", code: "danger" },
  { name: "Bilgi", className: "bg-info-600", code: "info" },
];

export function StyleguidePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="Tasarım Rehberi"
        description="Uygulamadaki her ekran sadece bu parçalardan oluşur. Yeni bir görünüm gerekiyorsa önce buraya eklenir."
      />

      <div className="space-y-6">
        <Section title="Marka">
          <div className="flex flex-wrap items-center gap-6">
            <div className="rounded-lg bg-brand-900 px-6 py-5 text-white">
              <Logo />
            </div>
            <div className="rounded-lg border border-line bg-surface px-6 py-5 text-brand-900">
              <Logo />
            </div>
          </div>
        </Section>

        <Section title="Renkler" description="Lacivert ana renk, şampanya sadece küçük vurgular için.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {swatches.map((swatch) => (
              <div key={swatch.code}>
                <div className={`h-14 rounded-md ${swatch.className}`} />
                <p className="mt-1.5 text-sm font-medium">{swatch.name}</p>
                <p className="text-xs text-ink-muted">{swatch.code}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Yazı" description="Başlıklar Jost (logodaki harflere yakın), metinler Inter.">
          <div className="space-y-3">
            <h1 className="text-[28px] font-normal tracking-tight">Sayfa başlığı · Etkinlikler</h1>
            <h2 className="text-xl">Bölüm başlığı · Ödeme Planı</h2>
            <p className="text-ink-soft">
              Normal metin. Kaya Düğün Organizasyonu için 300.000 ₺ tutarında anlaşma yapıldı.
            </p>
            <p className="text-sm text-ink-muted">Yardımcı metin · son güncelleme 5 Ekim 2026</p>
          </div>
        </Section>

        <Section title="Butonlar">
          <div className="flex flex-wrap gap-3">
            <Button>
              <Plus /> Yeni Teklif
            </Button>
            <Button variant="secondary">İkincil</Button>
            <Button variant="ghost">Sade</Button>
            <Button variant="danger">
              <Trash2 /> İptal Et
            </Button>
            <Button loading>Kaydediliyor</Button>
            <Button disabled>Pasif</Button>
            <Button variant="link">Bağlantı</Button>
          </div>
        </Section>

        <Section title="Durum Rozetleri" description="Renklerin anlamı her ekranda aynıdır.">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Ödendi</Badge>
            <Badge tone="warning">Kısmi tahsil</Badge>
            <Badge tone="danger">Gecikmiş</Badge>
            <Badge tone="info">Teklif gönderildi</Badge>
            <Badge tone="brand">Anlaşma</Badge>
            <Badge tone="neutral">Dönem kapalı</Badge>
          </div>
        </Section>

        <Section
          title="Para Gösterimi"
          description="Döviz işlemlerinde orijinal tutar ve TL karşılığı her zaman ayrı ve açık gösterilir."
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-ink-muted">TL</p>
              <Money amount="300000" />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-muted">Euro + TL karşılığı</p>
              <Money amount="12500" currency="EUR" baseAmount="455651.25" />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-muted">Kâr</p>
              <Money amount="84250.50" signed />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-muted">Zarar</p>
              <Money amount="-12000" signed />
            </div>
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Kasa + Banka" value={<Money amount="742350" />} hint="Özet kartı" />
          <StatCard
            label="Bekleyen Alacak"
            value={<Money amount="485000" />}
            hint="Uyarı tonu"
            icon={CalendarDays}
            tone="warning"
          />
          <StatCard
            label="Tıklanabilir kart"
            value="12"
            hint="Detaya gider"
            icon={Inbox}
            onClick={() => toast("Karta tıklandı")}
          />
        </div>

        <Section title="Form Alanları" description="Etiket, zorunluluk işareti, yardım ve hata metni hep aynı yerde.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Etkinlik adı" required hint="Müşterinin göreceği başlık">
              {(props) => <Input {...props} placeholder="Ör. Kaya Düğün Organizasyonu" />}
            </Field>
            <Field label="Para birimi">
              {(props) => (
                <Select {...props} defaultValue="TRY">
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Tutar" required error="Tutar sıfırdan büyük olmalıdır.">
              {(props) => <Input {...props} inputMode="decimal" defaultValue="0" />}
            </Field>
            <Field label="Tarih">{(props) => <Input {...props} type="date" />}</Field>
            <Field label="Not" className="sm:col-span-2">
              {(props) => <Textarea {...props} placeholder="İç not (müşteri görmez)" />}
            </Field>
          </div>
        </Section>

        <Section title="Sekmeler">
          <Tabs defaultValue="ozet">
            <TabsList>
              <TabsTrigger value="ozet">Özet</TabsTrigger>
              <TabsTrigger value="program">Program</TabsTrigger>
              <TabsTrigger value="odemeler">Ödemeler</TabsTrigger>
              <TabsTrigger value="giderler">Giderler</TabsTrigger>
              <TabsTrigger value="kapanis">Kapanış</TabsTrigger>
            </TabsList>
            <TabsContent value="ozet" className="text-sm text-ink-soft">
              Etkinlik detay sayfası bu sekmelerle düzenlenecek.
            </TabsContent>
            <TabsContent value="program" className="text-sm text-ink-soft">Program akışı</TabsContent>
            <TabsContent value="odemeler" className="text-sm text-ink-soft">Ödeme planı ve tahsilatlar</TabsContent>
            <TabsContent value="giderler" className="text-sm text-ink-soft">Giderler ve borçlar</TabsContent>
            <TabsContent value="kapanis" className="text-sm text-ink-soft">Finans kapanışı</TabsContent>
          </Tabs>
        </Section>

        <Section title="Pencereler ve Bildirimler" description="Mobilde alttan açılır, masaüstünde ortada.">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Form penceresi
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
              Onay penceresi
            </Button>
            <Button variant="secondary" onClick={() => toast.success("Tahsilat kaydedildi.")}>
              Başarı bildirimi
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast.error("Bu işlem yapılamaz çünkü dönem kapalı.")}
            >
              Hata bildirimi
            </Button>
          </div>
        </Section>

        <Card>
          <EmptyState
            icon={Inbox}
            title="Henüz tahsilat yok"
            description="Boş listeler her yerde bu şekilde gösterilir."
            action={
              <Button size="sm">
                <Plus /> Tahsilat Gir
              </Button>
            }
          />
        </Card>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Tahsilat Gir"
        description="Kaya Düğün Organizasyonu · kalan 250.000 ₺"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => setDialogOpen(false)}>
              <Save /> Kaydet
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tutar" required>
            {(props) => <Input {...props} inputMode="decimal" placeholder="0,00" />}
          </Field>
          <Field label="Tarih" required>
            {(props) => <Input {...props} type="date" />}
          </Field>
          <Field label="Parayı kim aldı?" required className="sm:col-span-2">
            {(props) => (
              <Select {...props}>
                <option>Şirket kasası</option>
                <option>Alper (ortak üzerinde)</option>
                <option>Volkan (ortak üzerinde)</option>
                <option>İbrahim (ortak üzerinde)</option>
              </Select>
            )}
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Dönem Kapatılacak"
        description="Eylül 2026 dönemi kapatılacak ve kilitlenecek."
        effects={[
          "Bu aya yeni kayıt girilemeyecek.",
          "3 açık alacak ve 2 açık borç Ekim 2026'ya devredecek.",
          "Net kâr 341.851,25 ₺ ortaklara eşit bölünecek.",
        ]}
        confirmLabel="Dönemi Kapat"
        tone="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          toast.success("Eylül 2026 dönemi kapatıldı.");
        }}
      />
    </>
  );
}
