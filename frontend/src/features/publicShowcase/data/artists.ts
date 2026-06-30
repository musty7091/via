import type { PublicArtist, PublicArtistCategory } from "../types/publicShowcaseTypes";

export const publicArtistCategories: PublicArtistCategory[] = [
  "Tümü",
  "Canlı Müzik",
  "DJ",
  "Solist",
  "Akustik",
  "Kurumsal",
  "Özel Konsept",
];

export const publicArtists: PublicArtist[] = [
  {
    id: "grup-frekans",
    slug: "grup-frekans",
    name: "Grup Frekans",
    category: "Canlı Müzik",
    style: "Pop / Rock Cover Band",
    description:
      "Kurumsal etkinlikler, özel geceler ve yüksek enerjili sahne programları için güçlü repertuvar.",
    coverImage: "/showcase/artists/grup-frekans/cover.jpg",
    hoverVideo: "/showcase/artists/grup-frekans/hover.mp4",
    tags: ["Canlı Müzik", "Kurumsal", "Düğün"],
    featured: true,
  },
  {
    id: "sidar-karakus",
    slug: "sidar-karakus",
    name: "Sidar Karakuş",
    category: "Solist",
    style: "Pop / Alternatif Sahne",
    description:
      "Modern repertuvarı ve güçlü sahne iletişimiyle butik organizasyonlar ve özel davetler için ideal.",
    coverImage: "/showcase/artists/sidar-karakus/cover.jpg",
    hoverVideo: "/showcase/artists/sidar-karakus/hover.mp4",
    tags: ["Solist", "Özel Davet", "Canlı Performans"],
  },
  {
    id: "reva",
    slug: "reva",
    name: "Reva",
    category: "Akustik",
    style: "Akustik / Lounge",
    description:
      "Karşılama, kokteyl ve zarif davet atmosferleri için soft akustik performans seçenekleri.",
    coverImage: "/showcase/artists/reva/cover.jpg",
    hoverVideo: "/showcase/artists/reva/hover.mp4",
    tags: ["Akustik", "Kokteyl", "Lounge"],
  },
  {
    id: "nafiz-dolek",
    slug: "nafiz-dolek",
    name: "Nafiz Dölek",
    category: "Solist",
    style: "Türkçe Pop / Sahne",
    description:
      "Geniş repertuvar ve güçlü yorumuyla düğün, gala ve özel gece programlarına sahne etkisi katar.",
    coverImage: "/showcase/artists/nafiz-dolek/cover.jpg",
    hoverVideo: "/showcase/artists/nafiz-dolek/hover.mp4",
    tags: ["Solist", "Gala", "Düğün"],
  },
  {
    id: "dj-performance",
    slug: "dj-performance",
    name: "DJ Performance",
    category: "DJ",
    style: "DJ Set / After Party",
    description:
      "Geceyi yükselten DJ setleri, after party akışları ve dans odaklı organizasyonlar için dinamik seçenek.",
    coverImage: "/showcase/artists/dj-performance/cover.jpg",
    hoverVideo: "/showcase/artists/dj-performance/hover.mp4",
    tags: ["DJ", "After Party", "Dans"],
  },
  {
    id: "corporate-stage",
    slug: "corporate-stage",
    name: "Kurumsal Sahne Paketi",
    category: "Kurumsal",
    style: "Gala / Lansman / Ödül Gecesi",
    description:
      "Sunucu, sahne akışı, müzik ve teknik ihtiyaçların tek konseptte planlandığı kurumsal program çözümü.",
    coverImage: "/showcase/artists/corporate-stage/cover.jpg",
    hoverVideo: "/showcase/artists/corporate-stage/hover.mp4",
    tags: ["Kurumsal", "Lansman", "Gala"],
  },
];
