export function BackOfficePreview() {
  return (
    <button className="group rounded-[1.7rem] border border-teal-300/30 bg-teal-400 p-5 text-left text-slate-950 shadow-xl shadow-teal-950/30 transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white">
        ₺
      </div>
      <h3 className="mt-5 text-2xl font-black">Back Office</h3>
      <p className="mt-2 text-sm leading-6 text-slate-800">
        Tahsilat, gider, operasyon, kârlılık, kasa ve ortak hesaplaşması
        burada yönetilecek.
      </p>
      <p className="mt-5 text-sm font-black text-slate-950">
        Güvenli giriş alanı →
      </p>
    </button>
  );
}
