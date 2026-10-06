import { Briefcase, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { useCan } from "@/features/auth/auth";
import { PAGE_SIZE, useCustomers, type CustomerListItem, type ListFilters } from "@/features/customers/api";
import { CustomerFormDialog } from "@/features/customers/CustomerFormDialog";
import { RiskBadge } from "@/features/customers/RiskBadge";
import { CUSTOMER_TYPE_LABELS, customerTypeOptions } from "@/shared/lib/labels";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  Toolbar,
  type Column,
} from "@/shared/ui";

const columns: Column<CustomerListItem>[] = [
  {
    key: "name",
    header: "Müşteri",
    cell: (c) => (
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
          {c.name}
          <RiskBadge level={c.risk_level} />
        </p>
        <p className="text-xs text-ink-muted">{CUSTOMER_TYPE_LABELS[c.customer_type]}</p>
      </div>
    ),
  },
  {
    key: "contact",
    header: "Ana yetkili",
    cell: (c) =>
      c.primary_contact_name ? (
        <div>
          <p>{c.primary_contact_name}</p>
          {c.primary_contact_phone && <p className="text-xs text-ink-muted">{c.primary_contact_phone}</p>}
        </div>
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
  { key: "phone", header: "Telefon", cell: (c) => c.phone ?? <span className="text-ink-faint">—</span> },
  { key: "city", header: "Şehir", hideOnMobile: true, cell: (c) => c.city ?? <span className="text-ink-faint">—</span> },
];

export function CustomersPage() {
  const can = useCan();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ListFilters>({ search: "", type: "", status: "active", offset: 0 });
  const [creating, setCreating] = useState(false);
  const customers = useCustomers(filters);
  const update = (patch: Partial<ListFilters>) => setFilters((f) => ({ ...f, offset: 0, ...patch }));

  return (
    <>
      <PageHeader
        eyebrow="Satış"
        title="Müşteriler"
        description="Teklif verilen ve etkinlik yapılan kişi ve kurumlar."
        actions={
          can("customers.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Yeni Müşteri
            </Button>
          )
        }
      />
      <Card>
        <Toolbar>
          <SearchInput
            value={filters.search}
            onChange={(search) => update({ search })}
            placeholder="Ad, telefon veya vergi no"
            className="sm:max-w-xs sm:flex-1"
          />
          <Select value={filters.type} onChange={(e) => update({ type: e.target.value })} className="sm:w-48" aria-label="Müşteri türü">
            <option value="">Tüm türler</option>
            {customerTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as ListFilters["status"] })}
            className="sm:w-36"
            aria-label="Durum"
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </Select>
        </Toolbar>
        {customers.isError ? (
          <ErrorState error={customers.error} />
        ) : (
          <DataTable
            columns={columns}
            rows={customers.data?.items ?? []}
            rowKey={(c) => c.id}
            onRowClick={(c) => navigate(`/musteriler/${c.id}`)}
            empty={
              customers.isPending ? (
                <LoadingState />
              ) : (
                <EmptyState
                  icon={Briefcase}
                  title={filters.search ? "Aramaya uygun müşteri yok" : "Henüz müşteri yok"}
                  action={
                    can("customers.manage") &&
                    !filters.search && (
                      <Button size="sm" onClick={() => setCreating(true)}>
                        <Plus /> Müşteri Ekle
                      </Button>
                    )
                  }
                />
              )
            }
          />
        )}
        <Pager
          offset={filters.offset}
          limit={PAGE_SIZE}
          total={customers.data?.total ?? 0}
          onChange={(offset) => setFilters((f) => ({ ...f, offset }))}
        />
      </Card>
      <CustomerFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(customer) => navigate(`/musteriler/${customer.id}`)}
      />
    </>
  );
}
