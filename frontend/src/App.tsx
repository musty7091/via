import { useState } from "react";

import { CustomersPage } from "./features/customers/pages/CustomersPage";
import { EventsPage } from "./features/events/pages/EventsPage";
import { OffersPage } from "./features/offers/pages/OffersPage";
import { ServiceCatalogPage } from "./features/serviceCatalog/pages/ServiceCatalogPage";
import { UserManagementPage } from "./features/userManagement/pages/UserManagementPage";
import { PartnersPage } from "./features/partners/pages/PartnersPage";
import { DashboardPage } from "./pages/DashboardPage";
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
  | "partners"
  | "users";

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
        onOpenUsers={() => setScreen("users")}
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

  if (screen === "users" && currentUser) {
    return (
      <UserManagementPage
        currentUser={currentUser}
        onBackToDashboard={() => setScreen("dashboard")}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.28),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.22),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0)_0%,_rgba(15,23,42,1)_100%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <button
              onClick={() => setScreen("landing")}
              className="group flex flex-col items-start"
              aria-label="VIA EVENTS ana sayfa"
            >
              <span className="text-sm font-black uppercase tracking-[0.55em] text-teal-400 transition group-hover:text-teal-200 sm:text-base">
                VIA EVENTS
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Event Experıence Platform
              </span>
            </button>

            
          </header>

          <section className="flex flex-1 items-center py-10">
            <div className="w-full">
              <div className="max-w-4xl">
                

                <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Etkinlik deneyiminizi birlikte planlayalım.
                </h1>

                <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                  Sanatçı tanıtımları, program seçenekleri ve etkinlik hizmetlerini
                  modern bir vitrinle keşfedin.
                </p>
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                <LandingCenterCard
                  eyebrow="Halka Açık"
                  title="Events"
                  subtitle="Etkinlik Vitrini"
                  description="Sanatçı tanıtımları, kısa videolar, program seçenekleri ve etkinlik hizmetleri bu alanda ziyaretçilere sunulur."
                  icon="✦"
                  tone="light"
                  actionLabel="Vitrini keşfet"
                />

                <LandingCenterCard
                  eyebrow="Yetkili Giriş"
                  title="Operations Center"
                  subtitle="Operasyon Merkezi"
                  description="Yetkili ekipler için teklif, anlaşma, etkinlik dosyası ve saha operasyon yönetimi."
                  icon="▣"
                  tone="dark"
                  actionLabel="Operasyon girişi"
                  onClick={() => setScreen("login")}
                />

                <LandingCenterCard
                  eyebrow="Yetkili Giriş"
                  title="Finance Center"
                  subtitle="Muhasebe Merkezi"
                  description="Yetkili kullanıcılar için tahsilat, gider, cari, kasa, banka, devir ve dönem takibi."
                  icon="₺"
                  tone="teal"
                  actionLabel="Muhasebe girişi"
                  onClick={() => setScreen("login")}
                />
              </div>

              <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-200">
                  <div className="text-center">Bize Ulaşın: 0533 846 31 31</div>
                </p>
                
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

type LandingCenterCardProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  tone: "light" | "dark" | "teal";
  actionLabel: string;
  onClick?: () => void;
};

function LandingCenterCard({
  eyebrow,
  title,
  subtitle,
  description,
  icon,
  tone,
  actionLabel,
  onClick,
}: LandingCenterCardProps) {
  const cardClasses =
    tone === "light"
      ? "border-white bg-white text-slate-950"
      : tone === "teal"
        ? "border-teal-300/30 bg-teal-300 text-slate-950"
        : "border-white/10 bg-white/10 text-white";

  const iconClasses =
    tone === "light" || tone === "teal"
      ? "bg-slate-950 text-white"
      : "bg-teal-300 text-slate-950";

  const descriptionClasses =
    tone === "light" || tone === "teal" ? "text-slate-600" : "text-slate-300";

  const eyebrowClasses =
    tone === "light" || tone === "teal" ? "text-slate-500" : "text-teal-200";

  const subtitleClasses =
    tone === "light" || tone === "teal" ? "text-slate-500" : "text-slate-300";

  return (
    <article
      className={`flex min-h-[20rem] flex-col rounded-[2rem] border p-6 shadow-2xl shadow-black/20 transition ${
        onClick ? "cursor-pointer hover:-translate-y-1" : ""
      } ${cardClasses}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black ${iconClasses}`}
      >
        {icon}
      </div>

      <div className="mt-7">
        <p className={`text-xs font-bold uppercase tracking-[0.25em] ${eyebrowClasses}`}>
          {eyebrow}
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
        <p className={`mt-1 text-sm font-bold ${subtitleClasses}`}>
          {subtitle}
        </p>
        <p className={`mt-4 text-sm leading-7 ${descriptionClasses}`}>
          {description}
        </p>
      </div>

      <div className="mt-auto pt-6">
        <span className="text-sm font-black">{actionLabel} →</span>
      </div>
    </article>
  );
}

export default App;
