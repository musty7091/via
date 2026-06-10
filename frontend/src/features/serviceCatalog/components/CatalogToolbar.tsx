type CatalogToolbarProps = {
  title: string;
  description: string;
  search: string;
  pageIndex: number;
  hasNextPage: boolean;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onOpenCreate: () => void;
};

export function CatalogToolbar({
  search,
  pageIndex,
  hasNextPage,
  isLoading,
  onSearchChange,
  onSearchSubmit,
  onPreviousPage,
  onNextPage,
  onOpenCreate,
}: CatalogToolbarProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearchSubmit();
              }
            }}
            placeholder="Ad veya açıklama ara..."
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSearchSubmit}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Ara
            </button>

            <button
              type="button"
              onClick={onOpenCreate}
              className="rounded-2xl bg-teal-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-200"
            >
              Yeni
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">
          <button
            type="button"
            disabled={pageIndex === 0 || isLoading}
            onClick={onPreviousPage}
            className="rounded-full bg-slate-100 px-3 py-2 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Önceki
          </button>

          <span className="rounded-full bg-slate-50 px-3 py-2 text-slate-500">
            Sayfa {pageIndex + 1} • 7 kayıt / sayfa
          </span>

          <button
            type="button"
            disabled={!hasNextPage || isLoading}
            onClick={onNextPage}
            className="rounded-full bg-slate-100 px-3 py-2 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sonraki →
          </button>
        </div>
      </div>
    </section>
  );
}