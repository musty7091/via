type EventToolbarProps = {
  search: string;
  pageIndex: number;
  hasNextPage: boolean;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function EventToolbar({
  search,
  pageIndex,
  hasNextPage,
  isLoading,
  onSearchChange,
  onSearchSubmit,
  onPreviousPage,
  onNextPage,
}: EventToolbarProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-700">
            Etkinlikler
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Etkinlik Dosyaları
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Anlaşmaya çevrilen teklifler burada gerçek iş dosyasına dönüşür.
            Operasyon, ödeme, gider ve kârlılık takibi buradan ilerleyecek.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 xl:w-[620px]">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSearchSubmit();
                }
              }}
              placeholder="Etkinlik adı veya kod ara..."
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <button
              onClick={onSearchSubmit}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
            >
              Ara
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <button
              disabled={pageIndex === 0 || isLoading}
              onClick={onPreviousPage}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Önceki
            </button>
            <span>Sayfa {pageIndex + 1} • 20 kayıt / sayfa</span>
            <button
              disabled={!hasNextPage || isLoading}
              onClick={onNextPage}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
