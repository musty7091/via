import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchPublicArtists,
  fetchPublicCategories,
  type ShowcaseArtist,
  type ShowcaseCategory,
} from "./showcaseApi";

type ShowcasePageProps = {
  onBack: () => void;
};

const ALL_KEY = "__all__";

export default function ShowcasePage({ onBack }: ShowcasePageProps) {
  const [categories, setCategories] = useState<ShowcaseCategory[]>([]);
  const [artists, setArtists] = useState<ShowcaseArtist[]>([]);
  const [activeKey, setActiveKey] = useState<string>(ALL_KEY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShowcaseArtist | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPublicCategories(), fetchPublicArtists()])
      .then(([cats, list]) => {
        if (cancelled) return;
        setCategories(cats);
        setArtists(list);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Vitrin yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleArtists = useMemo(() => {
    if (activeKey === ALL_KEY) return artists;
    return artists.filter((a) => a.category === activeKey);
  }, [artists, activeKey]);

  const totalCount = artists.length;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Ambient arka plan */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-7 sm:px-8">
        {/* Üst bar */}
        <header className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="group flex flex-col text-left"
            type="button"
          >
            <span className="text-sm font-black uppercase tracking-[0.5em] text-teal-400 transition group-hover:text-teal-200 sm:text-base">
              VIA EVENTS
            </span>
            <span className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Halka Açık Vitrin
            </span>
          </button>
          <button
            onClick={onBack}
            type="button"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-teal-300/60 hover:text-white"
          >
            ← Ana sayfa
          </button>
        </header>

        {/* Hero */}
        <section className="mt-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300/80">
            Sanatçı Vitrini
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Sahneyi dolduran isimleri keşfedin.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
            Gruplar, solo sanatçılar, DJ&apos;ler ve dansçılar. Karta gelin,
            sahne anları canlansın; detaylar için karta dokunun.
          </p>
        </section>

        {/* Sekmeler */}
        {!loading && !error && totalCount > 0 && (
          <nav className="mt-9 flex flex-wrap gap-2">
            <TabPill
              label="Tümü"
              count={totalCount}
              active={activeKey === ALL_KEY}
              onClick={() => setActiveKey(ALL_KEY)}
            />
            {categories.map((cat) => (
              <TabPill
                key={cat.key}
                label={cat.label}
                count={cat.count}
                active={activeKey === cat.key}
                onClick={() => setActiveKey(cat.key)}
              />
            ))}
          </nav>
        )}

        {/* İçerik */}
        <section className="mt-8 flex-1 pb-10">
          {loading && <ShowcaseSkeleton />}

          {!loading && error && (
            <div className="rounded-3xl border border-rose-400/30 bg-rose-500/5 p-8 text-center">
              <p className="text-rose-200">{error}</p>
            </div>
          )}

          {!loading && !error && totalCount === 0 && (
            <EmptyState />
          )}

          {!loading && !error && totalCount > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleArtists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  categoryLabel={
                    categories.find((c) => c.key === artist.category)?.label ??
                    artist.category
                  }
                  onDetails={() => setSelected(artist)}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-auto border-t border-white/10 py-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-teal-200">
            Bize Ulaşın: 0539 114 90 90
          </p>
        </footer>
      </div>

      {selected && (
        <DetailsModal artist={selected} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}

function TabPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-teal-400 text-slate-950 shadow-lg shadow-teal-500/20"
          : "border border-white/15 text-slate-300 hover:border-teal-300/50 hover:text-white"
      }`}
    >
      {label}
      <span
        className={`ml-2 text-xs ${
          active ? "text-slate-900/70" : "text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function ArtistCard({
  artist,
  categoryLabel,
  onDetails,
}: {
  artist: ShowcaseArtist;
  categoryLabel: string;
  onDetails: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function handleEnter() {
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
  }
  function handleLeave() {
    const v = videoRef.current;
    if (v) v.pause();
  }

  return (
    <article
      className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Sabit görsel */}
      {artist.image_url ? (
        <img
          src={artist.image_url}
          alt={artist.name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105 group-hover:opacity-80"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}

      {/* Hover'da oynayan yarı saydam video — sanatçı altta görünür kalır */}
      {artist.video_url && (
        <video
          ref={videoRef}
          src={artist.video_url}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-[0.85]"
        />
      )}

      {/* Okunabilirlik için degrade */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

      {/* İçerik */}
      <div className="relative mt-auto flex flex-col gap-3 p-5">
        <span className="w-fit rounded-full bg-teal-400/15 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-teal-200 backdrop-blur">
          {categoryLabel}
        </span>
        <div>
          <h3 className="text-2xl font-black leading-tight">{artist.name}</h3>
          {artist.tagline && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-300">
              {artist.tagline}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDetails}
          className="mt-1 w-fit rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-teal-400 hover:text-slate-950"
        >
          Detaylar →
        </button>
      </div>
    </article>
  );
}

function DetailsModal({
  artist,
  onClose,
}: {
  artist: ShowcaseArtist;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-lg text-white backdrop-blur transition hover:bg-black/80"
          aria-label="Kapat"
        >
          ✕
        </button>

        {/* Detay metni — EN ÜSTTE */}
        <div className="p-6 pr-14 sm:p-8 sm:pr-16">
          <h2 className="text-3xl font-black">{artist.name}</h2>
          {artist.tagline && (
            <p className="mt-2 text-lg text-teal-200">{artist.tagline}</p>
          )}
          {artist.description && (
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-300">
              {artist.description}
            </p>
          )}

          {(artist.instagram_url ||
            artist.youtube_url ||
            artist.spotify_url) && (
            <div className="mt-5 flex flex-wrap gap-3">
              {artist.instagram_url && (
                <SocialLink href={artist.instagram_url} label="Instagram" />
              )}
              {artist.youtube_url && (
                <SocialLink href={artist.youtube_url} label="YouTube" />
              )}
              {artist.spotify_url && (
                <SocialLink href={artist.spotify_url} label="Spotify" />
              )}
            </div>
          )}
        </div>

        {/* Medya — kırpılmadan, kendi oranında (dikey video tam görünür) */}
        {(artist.video_url || artist.image_url) && (
          <div className="flex justify-center bg-black">
            {artist.video_url ? (
              <video
                src={artist.video_url}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            ) : (
              <img
                src={artist.image_url ?? ""}
                alt={artist.name}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-teal-300/60 hover:text-white"
    >
      {label} ↗
    </a>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse rounded-3xl border border-white/10 bg-slate-900/70"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
      <p className="text-2xl font-black text-white">Vitrin yakında dolacak</p>
      <p className="mx-auto mt-3 max-w-md text-slate-400">
        Sanatçı tanıtımları hazırlanıyor. Çok yakında gruplar, DJ&apos;ler,
        dansçılar ve daha fazlası burada olacak.
      </p>
    </div>
  );
}
