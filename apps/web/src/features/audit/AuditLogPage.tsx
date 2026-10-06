import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { useState } from "react";

import { api, errorMessage, type Page, type Schema } from "@/shared/api/client";
import { formatDateTime } from "@/shared/lib/format";
import {
  Badge,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  Toolbar,
  type BadgeTone,
  type Column,
} from "@/shared/ui";

type AuditLog = Schema<"AuditLogRead">;

const PAGE_SIZE = 25;

const ENTITY_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  user: { label: "Kullanıcı", tone: "info" },
  partner: { label: "Ortak", tone: "brand" },
};

/** Alan adlarının ekranda görünen karşılıkları (teknik isim gösterilmez). */
const FIELD_LABELS: Record<string, string> = {
  full_name: "Ad soyad",
  email: "E-posta",
  role: "Rol",
  is_active: "Aktif",
  phone: "Telefon",
  sort_order: "Kuruş sırası",
  notes: "Not",
  user_id: "Kullanıcı hesabı",
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return String(value);
}

function isDiff(value: unknown): value is { before: unknown; after: unknown } {
  return typeof value === "object" && value !== null && "after" in value;
}

function ChangesTable({ changes }: { changes: Record<string, unknown> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-ink-muted">
          <th className="py-2 pr-3 font-medium">Alan</th>
          <th className="py-2 pr-3 font-medium">Önce</th>
          <th className="py-2 font-medium">Sonra</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(changes).map(([field, value]) => (
          <tr key={field} className="border-b border-line last:border-0">
            <td className="py-2 pr-3 text-ink-muted">{FIELD_LABELS[field] ?? field}</td>
            <td className="py-2 pr-3 text-ink-soft">{isDiff(value) ? displayValue(value.before) : "—"}</td>
            <td className="py-2 font-medium">{displayValue(isDiff(value) ? value.after : value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const logs = useQuery({
    queryKey: ["audit-logs", { search, entityType, offset }],
    queryFn: () =>
      api<Page<AuditLog>>("/audit-logs", {
        query: { search, entity_type: entityType, offset, limit: PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });

  const columns: Column<AuditLog>[] = [
    { key: "summary", header: "İşlem", cell: (log) => <span className="text-ink">{log.summary}</span> },
    {
      key: "type",
      header: "Kayıt türü",
      cell: (log) => {
        const entity = ENTITY_LABELS[log.entity_type];
        return <Badge tone={entity?.tone ?? "neutral"}>{entity?.label ?? log.entity_type}</Badge>;
      },
    },
    { key: "user", header: "Yapan", cell: (log) => log.user_name ?? <span className="text-ink-faint">Sistem</span> },
    { key: "date", header: "Zaman", cell: (log) => <span className="tabular">{formatDateTime(log.occurred_at)}</span> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="İşlem Geçmişi"
        description="Sistemde kim, ne zaman, neyi değiştirdi? Kayıtlar silinemez ve değiştirilemez."
      />
      <Card>
        <Toolbar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setOffset(0);
            }}
            placeholder="İşlemlerde ara"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setOffset(0);
            }}
            className="sm:w-44"
            aria-label="Kayıt türü"
          >
            <option value="">Tüm kayıt türleri</option>
            {Object.entries(ENTITY_LABELS).map(([value, entity]) => (
              <option key={value} value={value}>
                {entity.label}
              </option>
            ))}
          </Select>
        </Toolbar>
        {logs.isError ? (
          <p className="px-5 py-8 text-center text-sm text-danger-600">{errorMessage(logs.error)}</p>
        ) : (
          <DataTable
            columns={columns}
            rows={logs.data?.items ?? []}
            rowKey={(log) => log.id}
            onRowClick={setSelected}
            empty={
              logs.isPending ? (
                <p className="px-5 py-10 text-center text-sm text-ink-muted">Yükleniyor…</p>
              ) : (
                <EmptyState icon={ScrollText} title="Kayıt bulunamadı" />
              )
            }
          />
        )}
        <Pager offset={offset} limit={PAGE_SIZE} total={logs.data?.total ?? 0} onChange={setOffset} />
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title="İşlem Detayı"
        description={selected?.summary}
      >
        {selected && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-muted">Yapan</dt>
                <dd>{selected.user_name ?? "Sistem"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Zaman</dt>
                <dd>{formatDateTime(selected.occurred_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">IP adresi</dt>
                <dd>{selected.ip_address ?? "—"}</dd>
              </div>
            </dl>
            {selected.changes && Object.keys(selected.changes).length > 0 ? (
              <ChangesTable changes={selected.changes} />
            ) : (
              <p className="text-sm text-ink-muted">Bu işlemde alan değişikliği kaydı yok.</p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
