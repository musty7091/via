export type PublicArtistCategory =
  | "Tümü"
  | "Canlı Müzik"
  | "DJ"
  | "Solist"
  | "Akustik"
  | "Kurumsal"
  | "Özel Konsept";

export type PublicArtist = {
  id: string;
  slug: string;
  name: string;
  category: Exclude<PublicArtistCategory, "Tümü">;
  style: string;
  description: string;
  coverImage: string;
  hoverVideo: string;
  tags: string[];
  featured?: boolean;
};
