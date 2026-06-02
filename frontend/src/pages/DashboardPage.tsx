import type { AuthUser } from "../types/auth";

type DashboardPageProps = {
  user: AuthUser;
  onLogout: () => void;
  onOpenCustomers: () => void;
  onOpenServiceCatalog: () => void;
  onOpenOffers: () => void;
};

const dashboardCards = [
  {
    title: "Müşteriler",
    value: "Kartlar",
    description: "Müşteri, yetkili, mekân ve cari hesap hareketleri.",
    action: "customers",
  },
  {
    title: "Hizmet Kataloğu",
    value: "Katalog",
    description: "Sanatçı hizmetleri, teknik hizmetler ve program paketleri.",
    action: "serviceCatalog",
  },
  {
    title: "Teklif ve Anlaşma",
    value: "Print",
    description: "Müşteriye sunulacak teklif, anlaşma ve yazdırılabilir çıktı.",
    action: "offers",
  },
  {
    title: "Operasyon",
    value: "0",
    description: "Rider, görev ve saha hazırlıkları burada yönetilecek.",
    action: "operations",
  },
];

export function DashboardPage({
  user,
  onLogout,
  onOpenCustomers,
  onOpenServiceCatalog,
  onOpenOffers,
}: DashboardPageProps) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-700">
              VIA EVENTS
            </p>
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardCards.map((card) => {
            const isCustomerCard = card.action === "customers";
            const isServiceCatalogCard = card.action === "serviceCatalog";
            const isOffersCard = card.action === "offers";
            const isActiveCard = isCustomerCard || isServiceCatalogCard || isOffersCard;

            return (
              <button
                key={card.title}
                onClick={
                  isCustomerCard
                    ? onOpenCustomers
                    : isServiceCatalogCard
                      ? onOpenServiceCatalog
                      : isOffersCard
                        ? onOpenOffers
                        : undefined
                }
                className={`rounded-[1.5rem] bg-white p-5 text-left shadow-lg shadow-slate-200 transition ${
                  isActiveCard
                    ? "hover:-translate-y-1 hover:shadow-xl"
                    : "cursor-default opacity-80"
                }`}
              >
                <p className="text-sm font-bold text-slate-500">{card.title}</p>
                <p className="mt-3 text-3xl font-black">{card.value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {card.description}
                </p>
                {isActiveCard ? (
                  <p className="mt-4 text-sm font-black text-teal-700">
                    Modülü aç →
                  </p>
                ) : (
                  <p className="mt-4 text-sm font-semibold text-slate-400">
                    Sonraki adım
                  </p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-teal-200 bg-teal-50 p-5">
          <p className="text-sm font-bold text-teal-800">
            Teklif ve Anlaşma modülü başladı.
          </p>
          <p className="mt-2 text-sm leading-6 text-teal-900">
            Print çıktısı müşteri güvenli olacak; maliyet ve iç notlar sadece
            Back Office içinde kalacak.
          </p>
        </div>
      </section>
    </main>
  );
}
