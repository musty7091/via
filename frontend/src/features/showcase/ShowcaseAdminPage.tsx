import { useEffect, useState } from "react";
import {
  createArtist,
  deleteArtist,
  fetchAdminArtists,
  fetchAdminCategories,
  updateArtist,
  type ShowcaseArtist,
  type ShowcaseArtistInput,
  type ShowcaseCategory,
} from "./showcaseApi";

type ShowcaseAdminPageProps = {
  onBackToDashboard: () => void;
};

const EMPTY_FORM: ShowcaseArtistInput = {
  category: "gruplar",
  name: "",
  tagline: "",
  description: "",
  image_url: "",
  video_url: "",
  instagram_url: "",
  youtube_url: "",
  spotify_url: "",
  is_active: true,
  sort_order: 0,
};

export default function ShowcaseAdminPage({
  onBackToDashboard,
}: ShowcaseAdminPageProps) {
  const [categories, setCategories] = useState<ShowcaseCategory[]>([]);
  const [artists, setArtists] = useState<ShowcaseArtist[]>([]);
  const [form, setForm] = useState<ShowcaseArtistInput>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [cats, list] = await Promise.all([
        fetchAdminCategories(),
        fetchAdminArtists(),
      ]);
      setCategories(cats);
      setArtists(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Liste yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(artist: ShowcaseArtist) {
    setEditingId(artist.id);
    setForm({
      category: artist.category,
      name: artist.name,
      tagline: artist.tagline ?? "",
      description: artist.description ?? "",
      image_url: artist.image_url ?? "",
      video_url: artist.video_url ?? "",
      instagram_url: artist.instagram_url ?? "",
      youtube_url: artist.youtube_url ?? "",
      spotify_url: artist.spotify_url ?? "",
      is_active: artist.is_active ?? true,
      sort_order: artist.sort_order ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Sanatçı adı zorunludur.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // boş string'leri null'a çevir
      const payload: ShowcaseArtistInput = {
        ...form,
        tagline: form.tagline || null,
        description: form.description || null,
        image_url: form.image_url || null,
        video_url: form.video_url || null,
        instagram_url: form.instagram_url || null,
        youtube_url: form.youtube_url || null,
        spotify_url: form.spotify_url || null,
      };
      if (editingId) {
        await updateArtist(editingId, payload);
        setNotice("Sanatçı güncellendi.");
      } else {
        await createArtist(payload);
        setNotice("Sanatçı eklendi.");
      }
      resetForm();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(null), 3000);
    }
  }

  async function handleDelete(artist: ShowcaseArtist) {
    if (!window.confirm(`"${artist.name}" silinsin mi?`)) return;
    try {
      await deleteArtist(artist.id);
      if (editingId === artist.id) resetForm();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Silme başarısız.");
    }
  }

  const labelFor = (key: string) =>
    categories.find((c) => c.key === key)?.label ?? key;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
              Halka Açık Vitrin
            </p>
            <h1 className="mt-1 text-2xl font-normal text-slate-800 sm:text-3xl">
              Vitrin Yönetimi
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Halka açık vitrinde gösterilecek sanatçıları ekle ve düzenle.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-teal-300 hover:text-slate-900"
          >
            ← Panele dön
          </button>
        </header>

        {notice && (
          <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {editingId ? "Sanatçıyı düzenle" : "Yeni sanatçı ekle"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Vazgeç
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Kategori">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sanatçı adı *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Örn. Grup Anatolia"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Kısa slogan" full>
              <input
                value={form.tagline ?? ""}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Karta görünen tek satırlık tanıtım"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Açıklama (detay sayfası)" full>
              <textarea
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                placeholder="Detaylar penceresinde görünecek uzun tanıtım"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Görsel adresi (kart resmi)">
              <input
                value={form.image_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, image_url: e.target.value })
                }
                placeholder="https://.../foto.jpg"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Video adresi (hover'da oynar)">
              <input
                value={form.video_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, video_url: e.target.value })
                }
                placeholder="https://.../video.mp4"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Instagram">
              <input
                value={form.instagram_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, instagram_url: e.target.value })
                }
                placeholder="https://instagram.com/..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="YouTube">
              <input
                value={form.youtube_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, youtube_url: e.target.value })
                }
                placeholder="https://youtube.com/..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Spotify">
              <input
                value={form.spotify_url ?? ""}
                onChange={(e) =>
                  setForm({ ...form, spotify_url: e.target.value })
                }
                placeholder="https://open.spotify.com/..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>

            <Field label="Sıra (küçük önce gelir)">
              <input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) =>
                  setForm({ ...form, sort_order: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
              />
            </Field>
          </div>

          <label className="mt-4 flex w-fit items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-400"
            />
            Vitrinde yayında (aktif)
          </label>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-teal-500 disabled:opacity-60"
            >
              {saving
                ? "Kaydediliyor…"
                : editingId
                  ? "Değişiklikleri kaydet"
                  : "Sanatçı ekle"}
            </button>
          </div>
        </form>

        {/* Liste */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-800">
            Vitrindeki sanatçılar{" "}
            <span className="text-slate-400">({artists.length})</span>
          </h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Yükleniyor…</p>
          ) : artists.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              Henüz sanatçı eklenmedi. Yukarıdaki formdan ilk kaydı oluştur.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="h-16 w-16 flex-none overflow-hidden rounded-xl bg-slate-100">
                    {artist.image_url ? (
                      <img
                        src={artist.image_url}
                        alt={artist.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        ♪
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-slate-800">
                        {artist.name}
                      </p>
                      {!artist.is_active && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Pasif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {labelFor(artist.category)}
                      {artist.video_url ? " · video var" : ""}
                    </p>
                  </div>
                  <div className="flex flex-none gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(artist)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-teal-300 hover:text-slate-900"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(artist)}
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
