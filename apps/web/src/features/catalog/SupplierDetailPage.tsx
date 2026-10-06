import { Pencil } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

import { useCan } from "@/features/auth/auth";
import { useSupplier } from "@/features/catalog/api";
import { SupplierFormDialog } from "@/features/catalog/SuppliersTab";
import { PayeeLedgerCard } from "@/features/finance/PayeeLedgerCard";
import { Badge, Button, Card, CardBody, CardHeader, DescriptionList, ErrorState, LoadingState, PageHeader } from "@/shared/ui";

export function SupplierDetailPage() {
  const id = Number(useParams().id);
  const can = useCan();
  const supplier = useSupplier(id);
  const [editing, setEditing] = useState(false);

  if (supplier.isPending) return <LoadingState />;
  if (supplier.isError) return <ErrorState error={supplier.error} />;
  const s = supplier.data;

  return (
    <>
      <PageHeader
        back={{ to: "/katalog/tedarikciler", label: "Tedarikçiler" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.name}
            {!s.is_active && <Badge tone="neutral">Pasif</Badge>}
          </span>
        }
        description="Tedarikçi"
        actions={
          can("catalog.manage") && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil /> Düzenle
            </Button>
          )
        }
      />
      <Card>
        <CardHeader title="Bilgiler" />
        <CardBody>
          <DescriptionList
            items={[
              { label: "Yetkili", value: s.contact_name },
              { label: "Telefon", value: s.phone },
              { label: "E-posta", value: s.email },
              { label: "Vergi no", value: s.tax_number },
              { label: "IBAN", value: s.iban ? <span className="font-mono text-sm">{s.iban}</span> : null },
              { label: "Not", value: s.notes, wide: true },
            ]}
          />
        </CardBody>
      </Card>
      {can("finance.view") && <PayeeLedgerCard kind="suppliers" id={s.id} />}
      <SupplierFormDialog open={editing} onOpenChange={setEditing} supplier={s} />
    </>
  );
}
