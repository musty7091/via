import React from "react";

type CatalogEmptyStateProps = {
  modeLabel: string;
  onOpenCreate: () => void;
  readOnly?: boolean;
};

export function CatalogEmptyState({
  modeLabel,
  onOpenCreate,
  readOnly = false,
}: CatalogEmptyStateProps) {
  return (
    <div className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl sm:p-10">
      <p className="text-xs font-medium uppercase tracking-widest text-teal-400">
        ÇALIŞMA ALANI
      </p>
      <h2 className="mt-4 text-3xl font-normal leading-tight">
        {readOnly
          ? `Detayını görmek için bir ${modeLabel} seç.`
          : `Önce bir ${modeLabel} seç veya yeni kayıt oluştur.`}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-slate-400">
        Kayıt seçildiğinde detay, maliyet, teklif ve paket akışı bu alanda açılır. Böylece ekran tek kayıt üzerinde düzenli şekilde çalışır.
      </p>
      {readOnly ? null : (
        <button
          onClick={onOpenCreate}
          className="mt-8 rounded-full bg-teal-400 px-6 py-3 text-sm font-medium text-teal-950 transition hover:bg-teal-300"
        >
          Yeni Kayıt Oluştur
        </button>
      )}
    </div>
  );
}
