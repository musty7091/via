type OfferEmptyStateProps = {
  onOpenCreate: () => void;
};

export function OfferEmptyState({ onOpenCreate }: OfferEmptyStateProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
          Teklif Çalışma Alanı
        </p>
        <h2 className="mt-3 text-3xl font-black">
          Önce bir teklif seç veya yeni teklif oluştur.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Müşteri, etkinlik tarihi, program paketi, ödeme şartları ve print çıktısı
          bu alanda yönetilir. Maliyetler müşteriye gösterilmez.
        </p>
        <button
          onClick={onOpenCreate}
          className="mt-5 rounded-full bg-teal-300 px-5 py-3 text-sm font-black text-slate-950"
        >
          Yeni Teklif Oluştur
        </button>
      </div>
    </section>
  );
}
