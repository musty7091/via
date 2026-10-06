import { createBrowserRouter, Navigate } from "react-router";

import { AppShell } from "@/app/AppShell";
import { ComingSoonPage } from "@/app/ComingSoonPage";
import { AuditLogPage } from "@/features/audit/AuditLogPage";
import { ArtistDetailPage } from "@/features/catalog/ArtistDetailPage";
import { ArtistsTab } from "@/features/catalog/ArtistsTab";
import { CatalogLayout } from "@/features/catalog/CatalogLayout";
import { PackageDetailPage } from "@/features/catalog/PackageDetailPage";
import { SupplierDetailPage } from "@/features/catalog/SupplierDetailPage";
import { PackagesTab } from "@/features/catalog/PackagesTab";
import { ServicesTab } from "@/features/catalog/ServicesTab";
import { SuppliersTab } from "@/features/catalog/SuppliersTab";
import type { Permission } from "@/features/auth/auth";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth, RequirePermission } from "@/features/auth/RequireAuth";
import { ClosingPage } from "@/features/closing/ClosingPage";
import { CustomerDetailPage } from "@/features/customers/CustomerDetailPage";
import { CustomersPage } from "@/features/customers/CustomersPage";
import { VenuesPage } from "@/features/customers/VenuesPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { EventDetailPage } from "@/features/events/EventDetailPage";
import { EventsPage } from "@/features/events/EventsPage";
import { FinanceLayout } from "@/features/finance/FinanceLayout";
import { CashPage, CollectionsPage, ExpensesPage, PayablesPage } from "@/features/finance/FinanceListPages";
import { FinanceOverviewPage } from "@/features/finance/FinanceOverviewPage";
import { OfferDetailPage } from "@/features/offers/OfferDetailPage";
import { OfferPrintPage } from "@/features/offers/OfferPrintPage";
import { OffersPage } from "@/features/offers/OffersPage";
import { GeneralExpensesPage } from "@/features/finance/GeneralExpensesPage";
import { OperationsBoardPage } from "@/features/operations/OperationsBoardPage";
import { EventSheetPrintPage } from "@/features/print/EventSheetPrintPage";
import { PeriodPrintPage } from "@/features/print/PeriodPrintPage";
import { PeriodSummaryPrintPage } from "@/features/print/PeriodSummaryPrintPage";
import { ReportPrintPage } from "@/features/print/ReportPrintPage";
import { StatementPrintPage } from "@/features/print/StatementPrintPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PartnersPage } from "@/features/partners/PartnersPage";
import { StyleguidePage } from "@/features/styleguide/StyleguidePage";
import { UsersPage } from "@/features/users/UsersPage";

export const router = createBrowserRouter([
  { path: "/giris", element: <LoginPage /> },
  {
    // Yazdırma sayfası menüsüz, tam sayfa açılır.
    path: "/teklifler/:id/yazdir",
    element: (
      <RequireAuth>
        <RequirePermission permission="offers.view">
          <OfferPrintPage />
        </RequirePermission>
      </RequireAuth>
    ),
  },
  ...[
    { path: "/yazdir/ekstre/:kind/:id", permission: "finance.view", page: <StatementPrintPage /> },
    { path: "/yazdir/donem/:month", permission: "finance.view", page: <PeriodPrintPage /> },
    { path: "/yazdir/etkinlik/:id", permission: "events.view", page: <EventSheetPrintPage /> },
    { path: "/yazdir/rapor/:type", permission: "reports.view", page: <ReportPrintPage /> },
    { path: "/yazdir/donem-ozeti/:month", permission: "reports.view", page: <PeriodSummaryPrintPage /> },
  ].map(({ path, permission, page }) => ({
    path,
    element: (
      <RequireAuth>
        <RequirePermission permission={permission as Permission}>{page}</RequirePermission>
      </RequireAuth>
    ),
  })),
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: "kapanislar",
        element: (
          <RequirePermission permission="finance.view">
            <ClosingPage />
          </RequirePermission>
        ),
      },
      {
        path: "finans",
        element: (
          <RequirePermission permission="finance.view">
            <FinanceLayout />
          </RequirePermission>
        ),
        children: [
          { index: true, element: <FinanceOverviewPage /> },
          { path: "tahsilatlar", element: <CollectionsPage /> },
          { path: "borclar", element: <PayablesPage /> },
          { path: "giderler", element: <ExpensesPage /> },
          { path: "kasa", element: <CashPage /> },
        ],
      },
      { path: "teklifler", element: (
          <RequirePermission permission="offers.view">
            <OffersPage />
          </RequirePermission>
        ) },
      { path: "teklifler/:id", element: (
          <RequirePermission permission="offers.view">
            <OfferDetailPage />
          </RequirePermission>
        ) },
      { path: "etkinlikler", element: (
          <RequirePermission permission="events.view">
            <EventsPage />
          </RequirePermission>
        ) },
      { path: "etkinlikler/:id", element: (
          <RequirePermission permission="events.view">
            <EventDetailPage />
          </RequirePermission>
        ) },
      { path: "ayarlar", element: (
          <RequirePermission permission="settings.manage">
            <SettingsPage />
          </RequirePermission>
        ) },
      {
        path: "musteriler",
        element: (
          <RequirePermission permission="customers.view">
            <CustomersPage />
          </RequirePermission>
        ),
      },
      {
        path: "musteriler/:id",
        element: (
          <RequirePermission permission="customers.view">
            <CustomerDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: "katalog",
        element: (
          <RequirePermission permission="catalog.view">
            <CatalogLayout />
          </RequirePermission>
        ),
        children: [
          { index: true, element: <Navigate to="sanatcilar" replace /> },
          { path: "sanatcilar", element: <ArtistsTab /> },
          { path: "hizmetler", element: <ServicesTab /> },
          { path: "paketler", element: <PackagesTab /> },
          {
            path: "tedarikciler",
            element: (
              <RequirePermission permission="costs.view">
                <SuppliersTab />
              </RequirePermission>
            ),
          },
        ],
      },
      {
        path: "katalog/sanatcilar/:id",
        element: (
          <RequirePermission permission="catalog.view">
            <ArtistDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: "katalog/tedarikciler/:id",
        element: (
          <RequirePermission permission="costs.view">
            <SupplierDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: "katalog/paketler/:id",
        element: (
          <RequirePermission permission="catalog.view">
            <PackageDetailPage />
          </RequirePermission>
        ),
      },
      {
        path: "mekanlar",
        element: (
          <RequirePermission permission="customers.view">
            <VenuesPage />
          </RequirePermission>
        ),
      },
      {
        path: "operasyon",
        element: (
          <RequirePermission permission="operations.view">
            <OperationsBoardPage />
          </RequirePermission>
        ),
      },
      {
        path: "genel-giderler",
        element: (
          <RequirePermission permission="finance.view">
            <GeneralExpensesPage />
          </RequirePermission>
        ),
      },
      {
        path: "raporlar",
        element: (
          <RequirePermission permission="reports.view">
            <ReportsPage />
          </RequirePermission>
        ),
      },
      {
        path: "kullanicilar",
        element: (
          <RequirePermission permission="users.manage">
            <UsersPage />
          </RequirePermission>
        ),
      },
      {
        path: "ortaklar",
        element: (
          <RequirePermission permission="partners.view">
            <PartnersPage />
          </RequirePermission>
        ),
      },
      {
        path: "islem-gecmisi",
        element: (
          <RequirePermission permission="audit.view">
            <AuditLogPage />
          </RequirePermission>
        ),
      },
      {
        path: "tasarim",
        element: (
          <RequirePermission permission="settings.manage">
            <StyleguidePage />
          </RequirePermission>
        ),
      },
      { path: "*", element: <ComingSoonPage /> },
    ],
  },
]);
