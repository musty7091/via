type OfferToolbarProps = {
  search: string;
  statusFilter: string;
  pageIndex: number;
  hasNextPage: boolean;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSearchSubmit: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

const statusFilterOptions = [
  { value: "", label: "Aktif teklifler" },
  { value: "draft", label: "Taslak" },
  { value: "sent", label: "Gönderildi" },
  { value: "accepted", label: "Kabul edildi" },
  { value: "agreement", label: "Anlaşma" },
  { value: "rejected", label: "Reddedildi" },
  { value: "cancelled", label: "İptal" },
];

export function OfferToolbar({
  search,
  statusFilter,
  pageIndex,
  hasNextPage,
  isLoading,
  onSearchChange,
  onStatusFilterChange,
  onSearchSubmit,
  onPreviousPage,
  onNextPage,
}: OfferToolbarProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_190px_auto]">
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearchSubmit();
              }
            }}
            placeholder="Teklif no veya başlık ara..."
            className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
          />

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none ring-teal-500 transition focus:ring-4"
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onSearchSubmit}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Ara
          </button>
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
            Sayfa {pageIndex + 1} • 5 kayıt / sayfa
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