import React from "react";

type CatalogListProps = {
  mode: "artists" | "services" | "packages";
  items: any[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function CatalogList({ mode, items, selectedId, onSelect }: CatalogListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center text-sm font-medium text-slate-500 shadow-sm">
        Kayıt bulunamadı.
      </div>
    );
  }

  const formatCurrency = (val: any, cur: string) => {
    if (!val) return "";
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: cur || "TRY",
        minimumFractionDigits: 2,
      }).format(Number(val));
    } catch (e) {
      return `${val} ${cur}`;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        const title = item.full_name || item.title || item.name || "İsimsiz";
        const category = item.category || item.category_name || item.service_category || "Kategori Yok";
        const price = item.base_price || item.total_price || item.price;
        
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all ${
              isSelected
                ? "border-teal-400 bg-teal-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span className={`text-sm font-medium ${isSelected ? "text-teal-900" : "text-slate-800"}`}>
                {title}
              </span>
              <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-800">
                Aktif
              </span>
            </div>
            
            <span className="text-xs font-normal text-slate-500">
              {category}
            </span>
            
            {price ? (
              <span className="mt-1 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                {formatCurrency(price, item.currency)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}