import { useState } from "react";

import { CustomersPage } from "./features/customers/pages/CustomersPage";
import { EventsPage } from "./features/events/pages/EventsPage";
import { OffersPage } from "./features/offers/pages/OffersPage";
import { ServiceCatalogPage } from "./features/serviceCatalog/pages/ServiceCatalogPage";
import { PartnersPage } from "./features/partners/pages/PartnersPage";
import { BackOfficePreview } from "./pages/BackOfficePreview";
import { DashboardPage } from "./pages/DashboardPage";
import { EventsLandingPreview } from "./pages/EventsLandingPreview";
import { LoginPage } from "./pages/LoginPage";
import { clearAuthSession, getStoredUser } from "./services/authStorage";
import type { AuthUser } from "./types/auth";

type AppScreen =
  | "landing"
  | "login"
  | "dashboard"
  | "customers"
  | "serviceCatalog"
  | "offers"
  | "events"
  | "partners";

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    getStoredUser()
  );
  const [screen, setScreen] = useState<AppScreen>(() =>
    getStoredUser() ? "dashboard" : "landing"
  );

  function handleLoginSuccess(user: AuthUser) {
    setCurrentUser(user);
    setScreen("dashboard");
  }

  function handleLogout() {
    clearAuthSession();
    setCurrentUser(null);
    setScreen("landing");
  }

  if (screen === "login") {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onBack={() => setScreen("landing")}
      />
    );
  }

  if (screen === "dashboard" && currentUser) {
    return (
      <DashboardPage
        user={currentUser}
        onLogout={handleLogout}
        onOpenCustomers={() => setScreen("customers")}
        onOpenServiceCatalog={() => setScreen("serviceCatalog")}
        onOpenOffers={() => setScreen("offers")}
        onOpenEvents={() => setScreen("events")}
        onOpenPartners={() => setScreen("partners")}
      />
    );
  }

  if (screen === "customers" && currentUser) {
    return <CustomersPage onBackToDashboard={() => setScreen("dashboard")} />;
  }

  if (screen === "serviceCatalog" && currentUser) {
    return (
      <ServiceCatalogPage onBackToDashboard={() => setScreen("dashboard")} />
    );
  }

  if (screen === "offers" && currentUser) {
    return <OffersPage onBackToDashboard={() => setScreen("dashboard")} />;
  }

  if (screen === "events" && currentUser) {
    return <EventsPage onBackToDashboard={() => setScreen("dashboard")} />;
  }

  if (screen === "partners" && currentUser) {
    return <PartnersPage onBackToDashboard={() => setScreen("dashboard")} />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.34),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.26),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0)_0%,_rgba(15,23,42,1)_100%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-teal-300">
                VIA EVENTS
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Organizasyon Yönetim Platformu
              </h1>
            </div>

            <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/20 backdrop-blur">
              v0.7
            </div>
          </header>

          <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
            <section>
              <div className="max-w-2xl">
                <div className="mb-5 inline-flex rounded-full border border-teal-300/20 bg-teal-300/10 px-4 py-2 text-sm font-medium text-teal-100">
                  Mobil öncelikli • Çok kullanıcılı • Muhasebe kontrollü
                </div>

                <h2 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Etkinlik, operasyon ve ortak kârlılığı tek merkezde.
                </h2>

                <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
                  VIA EVENTS; sanatçı, müşteri, teklif, etkinlik, tahsilat,
                  rider, operasyon ve ay sonu ortak mahsuplaşmasını tek sistemde
                  toplamak için hazırlanıyor.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <EventsLandingPreview />
                  <BackOfficePreview onOpenLogin={() => setScreen("login")} />
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="rounded-[1.5rem] bg-slate-950/80 p-4">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Bugünkü Özet
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-white">
                      Yönetim Paneli Önizleme
                    </h3>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-teal-300 shadow-lg shadow-teal-300/60" />
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl bg-white p-4 text-slate-950">
                    <p className="text-sm font-medium text-slate-500">
                      Etkinlik Dosyası
                    </p>
                    <p className="mt-1 text-3xl font-black">Aktif</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Anlaşmalar artık gerçek etkinlik dosyasına dönüşüyor.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs text-slate-400">Müşteri</p>
                      <p className="mt-2 text-2xl font-black">Aktif</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs text-slate-400">Hizmet</p>
                      <p className="mt-2 text-2xl font-black">Katalog</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs text-slate-400">Teklif</p>
                      <p className="mt-2 text-2xl font-black">Print</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <p className="text-xs text-slate-400">Etkinlik</p>
                      <p className="mt-2 text-2xl font-black">Dosya</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4">
                    <p className="text-sm font-semibold text-teal-100">
                      Operasyon merkezi hazırlandı
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Sıradaki adımda ödeme planı ve operasyon föyü etkinlik
                      dosyasına bağlanacak.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
