import React from 'react';
import type { AuthUser } from "../types/auth";
import MainLayout from "../components/MainLayout";

type DashboardPageProps = {
  user: AuthUser;
  onLogout: () => void;
  onOpenCustomers: () => void;
  onOpenServiceCatalog: () => void;
  onOpenOffers: () => void;
  onOpenAgreements: () => void;
  onOpenEvents: () => void;
  onOpenPartners: () => void;
  onOpenFinanceCenter: () => void;
  onOpenUsers: () => void;
  onOpenExpenses?: () => void;
};

type WorkflowStep = {
  step: string;
  title: string;
  description: string;
  actionLabel: string;
  tone: "dark" | "teal" | "amber" | "emerald" | "indigo" | "slate";
  onClick: () => void;
};

function getWorkflowToneClass(tone: WorkflowStep["tone"]) {
  if (tone === "dark") {
    return {
      accent: "bg-slate-950 text-white",
      badge: "border-slate-200 bg-slate-50 text-slate-600",
      border: "hover:border-slate-300",
      action: "text-slate-950",
    };
  }

  if (tone === "teal") {
    return {
      accent: "bg-teal-500 text-white",
      badge: "border-teal-100 bg-teal-50 text-teal-700",
      border: "hover:border-teal-200",
      action: "text-teal-700",
    };
  }

  if (tone === "amber") {
    return {
      accent: "bg-amber-400 text-slate-950",
      badge: "border-amber-100 bg-amber-50 text-amber-700",
      border: "hover:border-amber-200",
      action: "text-amber-700",
    };
  }

  if (tone === "emerald") {
    return {
      accent: "bg-emerald-500 text-white",
      badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
      border: "hover:border-emerald-200",
      action: "text-emerald-700",
    };
  }

  if (tone === "indigo") {
    return {
      accent: "bg-indigo-500 text-white",
      badge: "border-indigo-100 bg-indigo-50 text-indigo-700",
      border: "hover:border-indigo-200",
      action: "text-indigo-700",
    };
  }

  return {
    accent: "bg-slate-200 text-slate-950",
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    border: "hover:border-slate-300",
    action: "text-slate-700",
  };
}

export function DashboardPage({
  user,
  onLogout,
  onOpenCustomers,
  onOpenServiceCatalog,
  onOpenOffers,
  onOpenAgreements,
  onOpenEvents,
}: DashboardPageProps) {
  const workflowSteps: WorkflowStep[] = [
    {
      step: "01",
      title: "Kataloğum",
      description: "Sanatçıları, ekstra hizmetleri, maliyet ve satış bedellerini yönet.",
      actionLabel: "Kataloğu aç",
      tone: "dark",
      onClick: onOpenServiceCatalog,
    },
    {
      step: "02",
      title: "Müşteri ve Mekanlar",
      description: "Müşteri, yetkili kişi ve mekan kayıtlarını operasyon için hazırla.",
      actionLabel: "Kayıtları aç",
      tone: "teal",
      onClick: onOpenCustomers,
    },
    {
      step: "03",
      title: "Teklif / Paket Hazırla",
      description: "Katalogdan seçim yap, fiyatları düzenle ve paket teklif oluştur.",
      actionLabel: "Teklifleri aç",
      tone: "amber",
      onClick: onOpenOffers,
    },
    {
      step: "04",
      title: "Anlaşmalar",
      description: "Kabul edilen teklifleri anlaşma sürecinde takip et.",
      actionLabel: "Anlaşmaları aç",
      tone: "emerald",
      onClick: onOpenAgreements,
    },
    {
      step: "05",
      title: "Etkinlik Dosyaları",
      description: "İmzalanan işleri etkinlik dosyası olarak planla ve izle.",
      actionLabel: "Dosyaları aç",
      tone: "indigo",
      onClick: onOpenEvents,
    },
    {
      step: "06",
      title: "Rider ve Saha Kontrol",
      description: "Sanatçı şartlarını ve saha hazırlıklarını etkinlik dosyasından yönet.",
      actionLabel: "Kontrol listelerini aç",
      tone: "slate",
      onClick: onOpenEvents,
    },
  ];

  return (
    <MainLayout userName={user.full_name} onLogout={onLogout}>
      <div className="flex flex-col h-full w-full">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm mb-6 flex-none">
          <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
            Operasyon Akışı
          </p>
          <div className="mt-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h2 className="text-2xl font-normal text-slate-800 sm:text-3xl">
                Katalogdan etkinlik dosyasına.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                Katalog, müşteri, teklif, anlaşma ve saha kontrol sürecini başlat.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium uppercase tracking-widest text-slate-500">
              6 adım
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pb-6">
          {workflowSteps.map((item) => {
            const toneClass = getWorkflowToneClass(item.tone);

            return (
              <button
                key={item.step}
                onClick={item.onClick}
                className={`group flex min-h-[12.5rem] flex-col rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneClass.border}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium ${toneClass.accent}`}
                  >
                    {item.step}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass.badge}`}
                  >
                    Operasyon
                  </span>
                </div>

                <div className="mt-6">
                  <h3 className="text-xl font-normal text-slate-800">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>

                <p className={`mt-auto pt-5 text-sm font-medium transition-colors ${toneClass.action}`}>
                  {item.actionLabel} →
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}