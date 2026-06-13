import React from "react";

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
    <div className="flex flex-col gap-4">
      {/* Arama ve Butonlar - Mobilde düzenli durması için flex-wrap ve grow kullandık */}
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearchSubmit();
          }}
          placeholder="Ara..."
          className="flex-1 bg-transparent px-4 py-2 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 min-w-0"
        />
        
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onSearchSubmit}
            disabled={isLoading}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            Ara
          </button>
          <button
            onClick={onOpenCreate}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Yeni
          </button>
        </div>
      </div>

      {/* Sayfalama - Daha sade ve okunabilir */}
      <div className="flex items-center justify-end gap-2 text-xs font-medium text-slate-500">
        <button
          onClick={onPreviousPage}
          disabled={pageIndex === 0 || isLoading}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
        >
          ← Önceki
        </button>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-slate-700">
          {pageIndex + 1}
        </span>
        <button
          onClick={onNextPage}
          disabled={!hasNextPage || isLoading}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
        >
          Sonraki →
        </button>
      </div>
    </div>
  );
}