export function EventsLandingPreview() {
  return (
    <button className="group rounded-[1.7rem] border border-white/10 bg-white p-5 text-left text-slate-950 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl text-white">
        ✦
      </div>
      <h3 className="mt-5 text-2xl font-black">Events</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Sanatçılar, hizmetler, etkinlik vitrini ve müşteri tarafı burada
        şekillenecek.
      </p>
      <p className="mt-5 text-sm font-bold text-teal-700 group-hover:text-teal-800">
        Vitrin alanı →
      </p>
    </button>
  );
}
