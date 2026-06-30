import type { PublicArtistCategory } from "../types/publicShowcaseTypes";

type ArtistFilterBarProps = {
  categories: PublicArtistCategory[];
  selectedCategory: PublicArtistCategory;
  onSelectCategory: (category: PublicArtistCategory) => void;
};

export function ArtistFilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
}: ArtistFilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-[1.6rem] border border-white/10 bg-white/5 p-2 backdrop-blur">
      {categories.map((category) => {
        const isSelected = selectedCategory === category;

        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
              isSelected
                ? "bg-teal-300 text-slate-950 shadow-lg shadow-teal-950/30"
                : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
