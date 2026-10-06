import { NavLink, Outlet } from "react-router";

import { useCan } from "@/features/auth/auth";
import { cn } from "@/shared/lib/cn";
import { PageHeader } from "@/shared/ui";

const TABS = [
  { to: "/katalog/sanatcilar", label: "Sanatçılar" },
  { to: "/katalog/hizmetler", label: "Hizmetler" },
  { to: "/katalog/paketler", label: "Paketler" },
  { to: "/katalog/tedarikciler", label: "Tedarikçiler", costsOnly: true },
];

export function CatalogLayout() {
  const can = useCan();
  return (
    <>
      <PageHeader
        eyebrow="Katalog"
        title="Sanatçı ve Hizmetler"
        description="Teklif hazırlarken kullanılan sanatçılar, teknik hizmetler ve hazır paketler."
      />
      <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Katalog bölümleri">
        {TABS.filter((tab) => !tab.costsOnly || can("costs.view")).map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
    </>
  );
}
