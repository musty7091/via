import { useEffect, useMemo, useState } from "react";

/**
 * usePagination — bir diz; verilen sayfa boyutuna göre dilimler.
 *
 * Tüm veriyi elde tutan (client-side) listeler için tasarlandı.
 * Liste uzunluğu veya `resetKey` değişince otomatik 1. sayfaya döner
 * (ör. arama yapılınca ya da başka bir etkinlik seçilince).
 */
export function usePagination<T>(
  items: T[],
  pageSize: number,
  resetKey?: unknown
) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Liste/filtre değişince başa dön
  useEffect(() => {
    setPage(1);
  }, [items.length, resetKey]);

  // Sayfa, sınırların dışına taşarsa düzelt
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, items.length);

  return {
    page,
    setPage,
    totalPages,
    total: items.length,
    pageItems,
    rangeStart,
    rangeEnd,
  };
}
