type PaginationProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  /** Toplam kayıt sayısı (opsiyonel; "X–Y / Z" metni için). */
  total?: number;
  rangeStart?: number;
  rangeEnd?: number;
  className?: string;
};

/**
 * Pagination — uygulamanın her yerinde aynı görünen sayfalama kontrolü.
 * Önceki / Sonraki + sayfa göstergesi + opsiyonel kayıt aralığı.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  total,
  rangeStart,
  rangeEnd,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <p className="text-xs font-semibold text-slate-500">
        {total != null && rangeStart != null && rangeEnd != null
          ? `${rangeStart}–${rangeEnd} / ${total} kayıt`
          : `Sayfa ${page} / ${totalPages}`}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => canPrev && onChange(page - 1)}
          disabled={!canPrev}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Önceki
        </button>

        <span className="min-w-[5.5rem] text-center text-xs font-black text-slate-700">
          Sayfa {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => canNext && onChange(page + 1)}
          disabled={!canNext}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sonraki →
        </button>
      </div>
    </div>
  );
}

export default Pagination;
