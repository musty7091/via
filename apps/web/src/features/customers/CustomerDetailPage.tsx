import { Building2, Mail, MapPin, Pencil, Phone, Plus, Star, UserRound } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { useCan } from "@/features/auth/auth";
import { useCustomer, type Contact, type Venue } from "@/features/customers/api";
import { ContactFormDialog } from "@/features/customers/ContactFormDialog";
import { CustomerFormDialog } from "@/features/customers/CustomerFormDialog";
import { CustomerLedgerTab } from "@/features/customers/CustomerLedgerTab";
import { CustomerSalesTab } from "@/features/customers/CustomerSalesTab";
import { RiskBadge } from "@/features/customers/RiskBadge";
import { VenueFormDialog } from "@/features/customers/VenueFormDialog";
import { CURRENCIES } from "@/shared/lib/format";
import { CUSTOMER_TYPE_LABELS, INVOICE_LABELS, VENUE_TYPE_LABELS } from "@/shared/lib/labels";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui";

function ContactCard({ contact, onEdit }: { contact: Contact; onEdit?: () => void }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
        <UserRound className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
          {contact.full_name}
          {contact.is_primary && (
            <Badge tone="brand" dot={false}>
              <Star className="size-3" aria-hidden /> Ana yetkili
            </Badge>
          )}
          {contact.is_accounting && <Badge dot={false}>Muhasebe</Badge>}
          {contact.is_operation && <Badge dot={false}>Operasyon</Badge>}
          {!contact.is_active && <Badge tone="neutral">Pasif</Badge>}
        </p>
        {contact.title && <p className="text-sm text-ink-muted">{contact.title}</p>}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
              <Phone className="size-3.5" aria-hidden /> {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700">
              <Mail className="size-3.5" aria-hidden /> {contact.email}
            </a>
          )}
        </div>
      </div>
      {onEdit && (
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`${contact.full_name} düzenle`}>
          <Pencil />
        </Button>
      )}
    </li>
  );
}

function VenueRow({ venue, onEdit }: { venue: Venue; onEdit?: () => void }) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-700">
        <MapPin className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
          {venue.name}
          {!venue.is_active && <Badge tone="neutral">Pasif</Badge>}
        </p>
        <p className="text-sm text-ink-muted">
          {[VENUE_TYPE_LABELS[venue.venue_type], venue.city, venue.capacity ? `${venue.capacity} kişi` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {venue.technical_notes && <p className="mt-1 text-sm text-ink-soft">{venue.technical_notes}</p>}
      </div>
      {onEdit && (
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`${venue.name} düzenle`}>
          <Pencil />
        </Button>
      )}
    </li>
  );
}

export function CustomerDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const canManage = can("customers.manage");
  const customer = useCustomer(id);
  const [editing, setEditing] = useState(false);
  const [contactForm, setContactForm] = useState<Contact | null | undefined>(undefined);
  const [venueForm, setVenueForm] = useState<Venue | null | undefined>(undefined);

  if (customer.isPending) return <LoadingState />;
  if (customer.isError) return <ErrorState error={customer.error} />;
  const c = customer.data;
  const currencyLabel = CURRENCIES.find((x) => x.value === c.default_currency)?.label;

  return (
    <>
      <PageHeader
        back={{ to: "/musteriler", label: "Müşteriler" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name}
            <RiskBadge level={c.risk_level} />
            {!c.is_active && <Badge tone="neutral">Pasif</Badge>}
          </span>
        }
        description={[CUSTOMER_TYPE_LABELS[c.customer_type], c.city].filter(Boolean).join(" · ")}
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil /> Düzenle
            </Button>
          )
        }
      />

      {c.risk_level !== "normal" && c.risk_note && (
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${c.risk_level === "blocked" ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700"}`}>
          <strong className="font-medium">Risk notu:</strong> {c.risk_note}
        </div>
      )}

      <Tabs defaultValue="genel">
        <TabsList>
          <TabsTrigger value="genel">Genel Bilgiler</TabsTrigger>
          <TabsTrigger value="yetkililer">Yetkililer ({c.contacts.length})</TabsTrigger>
          <TabsTrigger value="mekanlar">Mekânlar ({c.venues.length})</TabsTrigger>
          <TabsTrigger value="isler">Teklif ve Etkinlikler</TabsTrigger>
          {can("finance.view") && <TabsTrigger value="cari">Cari Hesap</TabsTrigger>}
        </TabsList>

        <TabsContent value="genel">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="İletişim ve Vergi" />
              <CardBody>
                <DescriptionList
                  items={[
                    { label: "Telefon", value: c.phone },
                    { label: "E-posta", value: c.email },
                    { label: "Vergi no", value: c.tax_number },
                    { label: "Vergi dairesi", value: c.tax_office },
                    { label: "Adres", value: [c.address, c.district, c.city].filter(Boolean).join(", "), wide: true },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Teklif Varsayılanları" description="Yeni teklif açılırken öneri olarak gelir." />
              <CardBody>
                <DescriptionList
                  items={[
                    { label: "Fatura tercihi", value: c.default_invoice ? INVOICE_LABELS[c.default_invoice] : "Her işte ayrıca seçilir" },
                    { label: "Para birimi", value: currencyLabel },
                    { label: "Ödeme vadesi", value: c.payment_term_days != null ? `${c.payment_term_days} gün` : null },
                    { label: "Not", value: c.notes, wide: true },
                  ]}
                />
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="yetkililer">
          <Card>
            <CardHeader
              title="Yetkililer"
              actions={
                canManage && (
                  <Button size="sm" onClick={() => setContactForm(null)}>
                    <Plus /> Yetkili Ekle
                  </Button>
                )
              }
            />
            {c.contacts.length === 0 ? (
              <EmptyState icon={UserRound} title="Henüz yetkili eklenmemiş" description="İlk eklenen yetkili otomatik olarak ana yetkili olur." />
            ) : (
              <ul className="divide-y divide-line">
                {c.contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} onEdit={canManage ? () => setContactForm(contact) : undefined} />
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="mekanlar">
          <Card>
            <CardHeader
              title="Müşteriye Ait Mekânlar"
              description="Otelin kendi salonu gibi. Bağımsız mekânlar Mekânlar sayfasında."
              actions={
                canManage && (
                  <Button size="sm" onClick={() => setVenueForm(null)}>
                    <Plus /> Mekân Ekle
                  </Button>
                )
              }
            />
            {c.venues.length === 0 ? (
              <EmptyState icon={Building2} title="Bu müşteriye ait mekân yok" />
            ) : (
              <ul className="divide-y divide-line">
                {c.venues.map((venue) => (
                  <VenueRow key={venue.id} venue={venue} onEdit={canManage ? () => setVenueForm(venue) : undefined} />
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="isler">
          <CustomerSalesTab customerId={c.id} />
        </TabsContent>
        <TabsContent value="cari">
          <CustomerLedgerTab customerId={c.id} />
        </TabsContent>
      </Tabs>

      <CustomerFormDialog open={editing} onOpenChange={setEditing} customer={c} />
      <ContactFormDialog
        customerId={c.id}
        open={contactForm !== undefined}
        onOpenChange={(open) => !open && setContactForm(undefined)}
        contact={contactForm}
      />
      <VenueFormDialog
        open={venueForm !== undefined}
        onOpenChange={(open) => !open && setVenueForm(undefined)}
        venue={venueForm}
        fixedCustomer={{ id: c.id, name: c.name }}
      />
    </>
  );
}

