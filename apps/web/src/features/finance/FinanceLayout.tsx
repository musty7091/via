import { ArrowDownToLine, ArrowLeftRight, Receipt } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";

import { useCan } from "@/features/auth/auth";
import { CollectionDialog } from "@/features/finance/CollectionDialog";
import { ExpenseDialog } from "@/features/finance/ExpenseDialog";
import { TransferDialog } from "@/features/finance/TransferDialog";
import { cn } from "@/shared/lib/cn";
import { Button, PageHeader } from "@/shared/ui";

const TABS = [
  { to: "/finans", label: "Özet", end: true },
  { to: "/finans/tahsilatlar", label: "Tahsilatlar" },
  { to: "/finans/borclar", label: "Borçlar ve Ödemeler" },
  { to: "/finans/giderler", label: "Giderler" },
  { to: "/finans/kasa", label: "Kasa ve Banka" },
];

export function FinanceLayout() {
  const can = useCan();
  const [dialog, setDialog] = useState<"collection" | "expense" | "transfer" | null>(null);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <PageHeader
        eyebrow="Finans"
        title="Finans Merkezi"
        description="Kasa, banka, alacaklar, borçlar ve ortak hesapları."
        actions={
          can("finance.record") && (
            <>
              <Button onClick={() => setDialog("collection")}>
                <ArrowDownToLine /> Tahsilat Gir
              </Button>
              <Button variant="secondary" onClick={() => setDialog("expense")}>
                <Receipt /> Gider Gir
              </Button>
              <Button variant="secondary" onClick={() => setDialog("transfer")}>
                <ArrowLeftRight /> Transfer
              </Button>
            </>
          )
        }
      />
      <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Finans bölümleri">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive ? "border-brand-900 text-brand-900" : "border-transparent text-ink-muted hover:text-ink",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
      <CollectionDialog open={dialog === "collection"} onOpenChange={close} />
      <ExpenseDialog open={dialog === "expense"} onOpenChange={close} />
      <TransferDialog open={dialog === "transfer"} onOpenChange={close} />
    </>
  );
}
