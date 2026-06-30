import { useRef, useState } from "react";

import type { PublicArtist } from "../types/publicShowcaseTypes";

type ArtistCardProps = {
  artist: PublicArtist;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCover, setHasCover] = useState(true);
  const [hasVideo, setHasVideo] = useState(true);
  const [isPreviewActive, setIsPreviewActive] = useState(false);

  function playPreview() {
    if (!hasVideo) {
      return;
    }

    setIsPreviewActive(true);
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.currentTime = 0;
    void video.play().catch(() => {
      setIsPreviewActive(false);
    });
  }

  function stopPreview() {
    setIsPreviewActive(false);
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.pause();
    video.currentTime = 0;
  }

  return (
    <article
      className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:border-teal-200/40 hover:bg-white/[0.08]"
      onMouseEnter={playPreview}
      onMouseLeave={stopPreview}
      onFocus={playPreview}
      onBlur={stopPreview}
      tabIndex={0}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-900">
        {hasCover ? (
          <img
            src={artist.coverImage}
            alt={`${artist.name} sanatçı kapak görseli`}
            onError={() => setHasCover(false)}
            className={`h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105 group-hover:opacity-35 ${
              isPreviewActive ? "opacity-25" : "opacity-95"
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_35%_20%,rgba(45,212,191,0.36),transparent_35%),linear-gradient(145deg,#020617,#111827_55%,#0f766e)] text-5xl font-black tracking-[0.25em] text-white/80 grayscale">
            {getInitials(artist.name)}
          </div>
        )}

        {hasVideo ? (
          <video
            ref={videoRef}
            src={artist.hoverVideo}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setHasVideo(false)}
            className={`absolute inset-0 h-full w-full scale-105 object-cover opacity-0 blur-[2px] brightness-75 saturate-75 transition duration-500 group-hover:opacity-70 ${
              isPreviewActive ? "opacity-70" : ""
            }`}
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />

        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          {artist.featured ? (
            <span className="rounded-full bg-teal-300 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-950">
              Öne Çıkan
            </span>
          ) : null}
          <span className="rounded-full bg-white/12 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
            {artist.category}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">
            {artist.style}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
            {artist.name}
          </h3>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <p className="min-h-[5.25rem] text-sm leading-7 text-slate-300">
          {artist.description}
        </p>

        <div className="flex flex-wrap gap-2">
          {artist.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            Performans
          </span>
          <span className="text-sm font-black text-teal-200 transition group-hover:text-teal-100">
            Detayları Gör →
          </span>
        </div>
      </div>
    </article>
  );
}
