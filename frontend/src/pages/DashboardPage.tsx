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
  onOpenExpenses?: () => void;
};

type OperationFlowCard = {
  title: string;
  value: string;
  description: string;
  accent: "dark" | "teal" | "slate" | "amber";
};

type OperationActionCard = {
  title: string;
  description: string;
  helper: string;
  icon: string;
  tone: "white" | "dark" | "teal" | "amber";
  adminOnly?: boolean;
  onClick: () => void;
};

const operationFlowCards: OperationFlowCard[] = [
  {
    title: "1. Katalog",
    value: "Hizmetler",
    description: "Sanatçı, teknik hizmet ve program paketleri düzenlenir.",
    accent: "dark",
  },
  {
    title: "2. Müşteri",
    value: "Hesaplar",
    description: "Müşteri, yetkili kişi, mekân ve cari bağlantılar takip edilir.",
    accent: "teal",
  },
  {
    title: "3. Teklif",
    value: "Anlaşmalar",
    description: "Teklif hazırlanır, anlaşmaya çevrilir ve çıktı alınır.",
    accent: "slate",
  },
  {
    title: "4. Etkinlik",
    value: "Dosyalar",
    description: "Onaylanan iş gerçek etkinlik dosyasına dönüşür.",
    accent: "amber",
  },
];

function getFlowAccentClass(accent: OperationFlowCard["accent"]) {
  if (accent === "dark") {
    return "before:bg-slate-950";
  }

  if (accent === "teal") {
    return "before:bg-teal-500";
  }

  if (accent === "amber") {
    return "before:bg-amber-500";
  }

  return "before:bg-slate-300";
}

function getActionToneClasses(tone: OperationActionCard["tone"]) {
  if (tone === "dark") {
    return "border-slate-950 bg-slate-950 text-white shadow-slate-300";
  }

  if (tone === "teal") {
    return "border-teal-200 bg-teal-50 text-slate-950 shadow-slate-200 hover:border-teal-300";
  }

  if (tone === "amber") {
    return "border-amber-200 bg-amber-50 text-slate-950 shadow-slate-200 hover:border-amber-300";
  }

  return "border-slate-200 bg-white text-slate-950 shadow-slate-200 hover:border-teal-200";
}

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
  onOpenExpenses,
}: DashboardPageProps) {
  const operationActions: OperationActionCard[] = [
    {
      title: "Müşteriler - Hesaplar",
      description: "Müşteri, yetkili, mekân ve cari hesap kayıtlarını yönet.",
      helper: "Müşteri ilişkileri ve hesap takibi bu modülde başlar.",
      icon: "◎",
      tone: "white",
      onClick: onOpenCustomers,
    },
    {
      title: "Hizmet Kataloğu",
      description: "Sanatçı hizmetleri, teknik hizmetler ve paketleri düzenle.",
      helper: "Tekliflerde kullanılacak hizmet altyapısı buradan beslenir.",
      icon: "▦",
      tone: "white",
      onClick: onOpenServiceCatalog,
    },
    {
      title: "Teklif ve Anlaşmalar",
      description: "Müşteriye sunulacak teklifleri ve anlaşmaları hazırla.",
      helper: "Onaylanan teklifler etkinlik dosyasına dönüşür.",
      icon: "✎",
      tone: "teal",
      onClick: onOpenOffers,
    },
    {
      title: "Etkinlik Dosyaları",
      description: "Gerçekleşecek işleri etkinlik dosyası olarak takip et.",
      helper: "Operasyon, ödeme ve kârlılık bu dosya üzerinden ilerler.",
      icon: "◇",
      tone: "dark",
      onClick: onOpenEvents,
    },
    {
      title: "Şirket Ortakları",
      description: "Ortak isimleri, pay oranları ve aktiflik durumunu yönet.",
      helper: "Kâr paylaşımı ve ortak cari takibi için temel kayıttır.",
      icon: "⇄",
      tone: "white",
      onClick: onOpenPartners,
    },
    {
      title: "Finans Merkezi",
      description: "Tahsilat, gider, cari, devir ve dönem kapanışını takip et.",
      helper: "Muhasebe işlemleri ayrı finans panelinde yürütülür.",
      icon: "₺",
      tone: "teal",
      onClick: onOpenFinanceCenter,
    },
    {
      title: "Gider Yönetimi",
      description: "Etkinlik giderleri, genel giderler ve dağıtılmış giderleri incele.",
      helper: "Detaylı liste, dağıtım ve iptal işlemleri burada takip edilir.",
      icon: "▣",
      tone: "amber",
      onClick: onOpenExpenses ?? onOpenFinanceCenter,
    },
    {
      title: "Kullanıcı Yönetimi",
      description: "Sistem kullanıcıları, roller ve şifre sıfırlama işlemleri.",
      helper: "Sadece yetkili kullanıcılar için yönetim alanıdır.",
      icon: "●",
      tone: "white",
      adminOnly: true,
      onClick: onOpenUsers,
    },
  ];

  const visibleOperationActions = operationActions.filter(
    (action) => !action.adminOnly || user.role === "super_admin"
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <img
              src="/brand/via-logo-horizontal.png"
              alt="VIA EVENTS"
              className="h-5 w-auto object-contain"
            />
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              Operasyon Merkezi
            </h1>
          </div>

          <button
            onClick={onLogout}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Çıkış
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-700">
                Operasyon Kontrol Paneli
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Günlük operasyon, teklif ve etkinlik takip ekranı.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Müşteri kayıtları, hizmet kataloğu, teklifler, anlaşmalar ve etkinlik dosyaları bu merkezden yönetilir.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Oturum
              </p>
              <p className="mt-1 text-sm font-black text-slate-950">{user.full_name}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{user.role}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {operationFlowCards.map((card) => (
            <article
              key={card.title}
              className={`relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200 before:absolute before:left-4 before:top-3 before:h-1 before:w-12 before:rounded-full ${getFlowAccentClass(
                card.accent
              )}`}
            >
              <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                {card.title}
              </p>
              <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                {card.value}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {card.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                Hızlı Erişim
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight">
                Operasyon modülleri
              </h3>
            </div>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-black text-teal-700">
              Tek merkezden yönetim
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleOperationActions.map((action) => (
              <button
                key={action.title}
                onClick={action.onClick}
                className={`rounded-[1.25rem] border p-4 text-left shadow-md transition hover:-translate-y-1 hover:shadow-lg ${getActionToneClasses(
                  action.tone
                )}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-white">
                    {action.icon}
                  </span>
                  <div>
                    <p className="text-base font-black leading-5">{action.title}</p>
                    <p className="mt-2 text-sm leading-6 opacity-75">
                      {action.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-bold leading-5 opacity-65">
                    {action.helper}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-teal-200 bg-teal-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-teal-900">
                Operasyon akışı hazır.
              </p>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-teal-900">
                Katalogdan başlayan süreç müşteri, teklif ve etkinlik dosyasıyla ilerler. Finansal tahsilat, gider ve dönem kapanışı Finans Merkezi üzerinden takip edilir.
              </p>
            </div>
            <button
              onClick={onOpenEvents}
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Etkinlik dosyalarına git
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
