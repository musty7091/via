import { Handshake, Mail, Pencil, Phone, Plus, Scale, UserRound } from "lucide-react";
import { useState } from "react";

import { useCan } from "@/features/auth/auth";
import { usePartnerBalances, usePartnerStatement } from "@/features/finance/api";
import { PartnerBalancesCard } from "@/features/finance/PartnerBalancesCard";
import { StatementTable } from "@/features/finance/StatementTable";
import { usePartners, type Partner } from "@/features/partners/api";
import { PartnerFormDialog } from "@/features/partners/PartnerFormDialog";
import { PrintLink } from "@/features/print/PrintLink";
import { errorMessage } from "@/shared/api/client";
import { Badge, Button, Card, Checkbox, Dialog, EmptyState, PageHeader } from "@/shared/ui";

function StatementDialog({ partner, onClose }: { partner: Partner | null; onClose: () => void }) {
  const statement = usePartnerStatement(partner?.id ?? 0);
  return (
    <Dialog
      open={partner !== null}
      onOpenChange={(open) => !open && onClose()}
      title={`${partner?.full_name ?? ""} · Ortak Ekstresi`}
      description="Bakiye: artı değer ortağın şirkete teslim etmesi gereken para, eksi değer şirketin ortağa borcudur (TL)."
      size="lg"
      footer={partner ? <PrintLink to={`/yazdir/ekstre/ortak/${partner.id}`} label="Ekstreyi yazdır" /> : undefined}
    >
      <div className="-mx-5 -my-4">
        <StatementTable
          rows={statement.data ?? []}
          loading={statement.isPending}
          debitLabel="Ortağa geçen"
          creditLabel="Ortaktan çıkan"
          balanceLabel="Bakiye"
        />
      </div>
    </Dialog>
  );
}

function PartnerCard({
  partner,
  canManage,
  onEdit,
  onStatement,
}: {
  partner: Partner;
  canManage: boolean;
  onEdit: () => void;
  onStatement?: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-900 font-display text-lg text-white">
          {partner.full_name.charAt(0).toLocaleUpperCase("tr")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg">{partner.full_name}</h3>
            {!partner.is_active && <Badge tone="neutral">Pasif</Badge>}
          </div>
          <p className="text-xs text-ink-muted">Kuruş sırası: {partner.sort_order}</p>
        </div>
        {canManage && (
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={`${partner.full_name} düzenle`}>
            <Pencil />
          </Button>
        )}
      </div>
      <dl className="mt-auto space-y-2 border-t border-line px-5 py-4 text-sm">
        <div className="flex items-center gap-2 text-ink-soft">
          <Phone className="size-4 text-ink-faint" aria-hidden />
          <dt className="sr-only">Telefon</dt>
          <dd>{partner.phone ?? <span className="text-ink-faint">Telefon yok</span>}</dd>
        </div>
        <div className="flex items-center gap-2 text-ink-soft">
          <Mail className="size-4 text-ink-faint" aria-hidden />
          <dt className="sr-only">E-posta</dt>
          <dd className="truncate">{partner.email ?? <span className="text-ink-faint">E-posta yok</span>}</dd>
        </div>
        <div className="flex items-center gap-2 text-ink-soft">
          <UserRound className="size-4 text-ink-faint" aria-hidden />
          <dt className="sr-only">Kullanıcı hesabı</dt>
          <dd className="truncate">
            {partner.user_email ?? <span className="text-ink-faint">Kullanıcı hesabı bağlı değil</span>}
          </dd>
        </div>
      </dl>
      {onStatement && (
        <div className="border-t border-line px-5 py-3">
          <Button variant="link" size="sm" onClick={onStatement}>
            Hesap ekstresi
          </Button>
        </div>
      )}
    </Card>
  );
}

export function PartnersPage() {
  const can = useCan();
  const canManage = can("partners.manage");
  const [showInactive, setShowInactive] = useState(false);
  const [formPartner, setFormPartner] = useState<Partner | null | undefined>(undefined);
  const partners = usePartners(showInactive);
  const showFinance = can("finance.view");
  const balances = usePartnerBalances();
  const [statementFor, setStatementFor] = useState<Partner | null>(null);

  const list = partners.data ?? [];
  const activeCount = list.filter((p) => p.is_active).length;
  const nextSortOrder = list.reduce((max, p) => Math.max(max, p.sort_order), 0) + 1;

  return (
    <>
      <PageHeader
        eyebrow="Finans"
        title="Ortaklar"
        description="Şirket ortakları, ortak üzerindeki şirket parası ve şirketin ortaklara borcu."
        actions={
          canManage && (
            <Button onClick={() => setFormPartner(null)}>
              <Plus /> Yeni Ortak
            </Button>
          )
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <Scale className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Kâr ve zarar <strong className="font-medium">{activeCount ? `${activeCount} aktif ortak` : "aktif ortaklar"}</strong> arasında
          eşit bölünür. Tam bölünmeyen kuruşlar kuruş sırasına göre dağıtılır; hiçbir kuruş kaybolmaz.
        </p>
      </div>

      <div className="mb-4 flex justify-end">
        <Checkbox
          label="Pasif ortakları da göster"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
      </div>

      {partners.isError ? (
        <p className="text-sm text-danger-600">{errorMessage(partners.error)}</p>
      ) : partners.isPending ? (
        <p className="text-sm text-ink-muted">Yükleniyor…</p>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={Handshake}
            title="Henüz ortak eklenmemiş"
            action={
              canManage && (
                <Button size="sm" onClick={() => setFormPartner(null)}>
                  <Plus /> Ortak Ekle
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((partner) => (
            <PartnerCard
              key={partner.id}
              partner={partner}
              canManage={canManage}
              onEdit={() => setFormPartner(partner)}
              onStatement={showFinance ? () => setStatementFor(partner) : undefined}
            />
          ))}
        </div>
      )}

      {showFinance && balances.data && (
        <div className="mt-6 max-w-2xl">
          <PartnerBalancesCard balances={balances.data} />
        </div>
      )}
      <StatementDialog partner={statementFor} onClose={() => setStatementFor(null)} />
      <PartnerFormDialog
        open={formPartner !== undefined}
        onOpenChange={(open) => !open && setFormPartner(undefined)}
        partner={formPartner}
        nextSortOrder={nextSortOrder}
      />
    </>
  );
}
