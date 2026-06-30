/**
 * Salt-okur modu uyarı şeridi.
 * Operasyon alanını yalnızca görüntüleyebilen roller (muhasebe, görüntüleyici)
 * için sayfa üstünde gösterilir.
 */
export function ReadOnlyBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-amber-400 text-sm font-black text-white">
        👁
      </span>
      <p className="text-sm font-bold text-amber-900">
        Salt görüntüleme modundasınız. Bu alanda kayıt ekleyemez veya
        değiştiremezsiniz; yalnızca inceleyebilirsiniz.
      </p>
    </div>
  );
}
