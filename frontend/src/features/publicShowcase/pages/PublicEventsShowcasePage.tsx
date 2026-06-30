import { useMemo, useState } from "react";

import { ArtistCard } from "../components/ArtistCard";
import { ArtistFilterBar } from "../components/ArtistFilterBar";
import { publicArtistCategories, publicArtists } from "../data/artists";
import type { PublicArtistCategory } from "../types/publicShowcaseTypes";

type PublicEventsShowcasePageProps = {
  onBackToLanding: () => void;
};

export function PublicEventsShowcasePage({
  onBackToLanding,
}: PublicEventsShowcasePageProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<PublicArtistCategory>("Tümü");

  const filteredArtists = useMemo(() => {
    if (selectedCategory === "Tümü") {
      return publicArtists;
    }

    return publicArtists.filter((artist) => artist.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.24),_transparent_32%),radial-gradient(circle_at_82%_8%,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(180deg,_rgba(15,23,42,0)_0%,_rgba(15,23,42,1)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/60 to-transparent" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onBackToLanding}
              className="group flex flex-col items-start"
              aria-label="VIA EVENTS ana sayfaya dön"
            >
              <span className="text-sm font-black uppercase tracking-[0.55em] text-teal-400 transition group-hover:text-teal-200 sm:text-base">
                VIA EVENTS
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Etkinlik ve Organizasyon Platformu
              </span>
            </button>

            <button
              type="button"
              onClick={onBackToLanding}
              className="w-fit rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-slate-200 transition hover:border-teal-200/50 hover:bg-white/10 hover:text-white"
            >
              ← Ana sayfa
            </button>
          </header>

          <section className="py-12 sm:py-16 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-teal-300">
                  Halka Açık Vitrin
                </p>
                <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Sanatçılar ve sahne programları.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 sm:text-lg">
                  Etkinliğinize uygun sanatçıları, canlı performansları ve
                  program seçeneklerini keşfedin. Kartların üzerine geldiğinizde
                  sahne atmosferini kısa performans videolarıyla görün.
                </p>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur">
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">
                  Hızlı İletişim
                </p>
                <p className="mt-3 text-3xl font-black tracking-tight text-teal-200">
                  0539 114 90 90
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Sanatçı uygunluğu, program akışı ve teklif seçenekleri için
                  bizimle iletişime geçebilirsiniz.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <ArtistFilterBar
                categories={publicArtistCategories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredArtists.map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>

            {filteredArtists.length === 0 ? (
              <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center">
                <p className="text-sm font-bold text-slate-300">
                  Bu kategoride gösterilecek sanatçı bulunamadı.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
