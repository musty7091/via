import type { AuthUser } from "../types/auth";

type DashboardPageProps = {
  user: AuthUser;
  onLogout: () => void;
  onOpenCustomers: () => void;
  onOpenServiceCatalog: () => void;
  onOpenOffers: () => void;
  onOpenEvents: () => void;
  onOpenPartners: () => void;
  onOpenFinanceCenter: () => void;
  onOpenUsers: () => void;
};

const dashboardCards = [
  {
    value: "Müşteriler-Hesaplar",
    description: "Müşteri, yetkili, mekân ve cari hesap hareketleri.",
    action: "customers",
  },
  {
    value: "Hizmet Kataloğu",
    description: "Sanatçı hizmetleri, teknik hizmetler ve program paketleri.",
    action: "serviceCatalog",
  },
  {
    value: "Teklif ve Anlaşmalar",
    description: "Müşteriye sunulacak teklif, anlaşma ve yazdırılabilir çıktı.",
    action: "offers",
  },
  {
    value: "Etkinlik Dosyaları",
    description: "Anlaşmadan oluşan gerçek etkinlik dosyaları.",
    action: "events",
  },
  {
    value: "Şirket Ortakları",
    description: "Ortak isimleri, pay oranları ve aktiflik durumu.",
    action: "partners",
  },
  {
    value: "Finans Merkezi",
    description: "Tahsilat, gider, cari, devir ve dönem kapanışı.",
    action: "finance",
  },
  {
    value: "Kullanıcı Yönetimi",
    description: "Sistem kullanıcısı oluşturma, roller ve şifre sıfırlama.",
    action: "users",
    adminOnly: true,
  },
];

export function DashboardPage({
  user,
  onLogout,
  onOpenCustomers,
  onOpenServiceCatalog,
  onOpenOffers,
  onOpenEvents,
  onOpenPartners,
  onOpenFinanceCenter,
  onOpenUsers,
}: DashboardPageProps) {
  const visibleDashboardCards = dashboardCards.filter(
    (card) => !card.adminOnly || user.role === "super_admin"
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <img src="/brand/via-logo-horizontal.png" alt="VIA EVENTS" className="h-5 w-auto object-contain" />
            <h1 className="mt-1 text-xl font-black sm:text-2xl">
              Back Office
            </h1>
          </div>

          <button
            onClick={onLogout}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
          >
            Çıkış
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-6">
        <div className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
          <p className="text-sm text-teal-200">Hoş geldin</p>
          <h2 className="mt-1 text-3xl font-black">{user.full_name}</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white/10 px-3 py-2">
              {user.email}
            </span>
            <span className="rounded-full bg-teal-300 px-3 py-2 font-bold text-slate-950">
              {user.role}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {visibleDashboardCards.map((card) => (
            <button
              key={card.action}
              onClick={
                card.action === "customers"
                  ? onOpenCustomers
                  : card.action === "serviceCatalog"
                    ? onOpenServiceCatalog
                    : card.action === "offers"
                      ? onOpenOffers
                      : card.action === "partners"
                        ? onOpenPartners
                        : card.action === "finance"
                          ? onOpenFinanceCenter
                          : card.action === "users"
                            ? onOpenUsers
                            : onOpenEvents
              }
              className="rounded-[1.5rem] bg-white p-5 text-left shadow-lg shadow-slate-200 transition hover:-translate-y-1 hover:shadow-xl"
            >
              <p className="text-sm font-bold text-slate-500">VIA EVENTS</p>
              <p className="mt-3 text-3xl font-black">{card.value}</p>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {card.description}
              </p>
              <p className="mt-4 text-sm font-black text-teal-700">
                Modülü aç →
              </p>
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-teal-200 bg-teal-50 p-5">
          <p className="text-sm font-bold text-teal-800">
            Etkinlik dosyaları aktif.
          </p>
          <p className="mt-2 text-sm leading-6 text-teal-900">
            Anlaşmaya çevrilen teklifler artık gerçek etkinlik dosyasına
            dönüşüyor. Operasyon, ödeme ve kârlılık bundan sonra bu dosyaya
            bağlanacak.
          </p>
        </div>
      </section>
    </main>
  );
}
