export function EventEmptyState() {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
          Etkinlik Dosyası
        </p>
        <h2 className="mt-3 text-3xl font-black">
          Henüz seçili etkinlik yok.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Teklif ve Anlaşma modülünde bir teklif anlaşmaya çevrildiğinde burada
          gerçek etkinlik dosyası oluşur. Bundan sonraki ödeme, operasyon, rider
          ve kârlılık adımları bu dosyaya bağlanacak.
        </p>
      </div>
    </section>
  );
}
