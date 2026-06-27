import { useEffect, useMemo, useState } from "react";

import { Pagination } from "../../../components/Pagination";
import { ViaPageShell } from "../../../components/layout/ViaPageShell";
import { usePagination } from "../../../hooks/usePagination";
import {
  createRiderCheck,
  deleteRiderCheck,
  fetchEventOptions,
  fetchRiderBoard,
  generateRiderChecks,
  updateRiderCheck,
} from "../api/riderApi";
import type {
  EventOption,
  RiderCheck,
  RiderCheckBoard,
  RiderCheckStatus,
} from "../types/riderTypes";

type RiderControlPageProps = {
  onBackToDashboard: () => void;
};

const STATUS_LABEL: Record<RiderCheckStatus, string> = {
  pending: "Bekliyor",
  done: "Tamam",
  problem: "Sorunlu",
};

// Tek pencerede sığması için sayfa başı kayıt sınırları
const EVENTS_PER_PAGE = 7;
const CHECKS_PER_PAGE = 6;

function formatDate(value: string | null) {
  if (!value) return "Tarih yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function RiderControlPage({ onBackToDashboard }: RiderControlPageProps) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [board, setBoard] = useState<RiderCheckBoard | null>(null);

  const [search, setSearch] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [problemDrafts, setProblemDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    setLoadingEvents(true);
    fetchEventOptions()
      .then((data) => {
        if (!active) return;
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId((current) => current ?? data[0].id);
        }
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoadingEvents(false));
    return () => {
      active = false;
    };
  }, []);

  async function loadBoard(eventId: number) {
    setLoadingBoard(true);
    setError(null);
    try {
      const data = await fetchRiderBoard(eventId);
      setBoard(data);
    } catch (err) {
      setError((err as Error).message);
      setBoard(null);
    } finally {
      setLoadingBoard(false);
    }
  }

  useEffect(() => {
    if (selectedEventId != null) {
      void loadBoard(selectedEventId);
      setInfo(null);
    }
  }, [selectedEventId]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return events;
    return events.filter((event) =>
      event.title.toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [events, search]);

  const eventPaging = usePagination(filteredEvents, EVENTS_PER_PAGE, search);
  const checkPaging = usePagination(
    board?.items ?? [],
    CHECKS_PER_PAGE,
    selectedEventId
  );

  async function handleGenerate() {
    if (selectedEventId == null) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await generateRiderChecks(selectedEventId);
      setBoard(result.board);
      setInfo(
        result.created_count > 0
          ? `${result.created_count} kontrol maddesi oluşturuldu.`
          : "Yeni madde yok — şablon maddeleri zaten eklenmişti."
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(check: RiderCheck, status: RiderCheckStatus) {
    setBusy(true);
    setError(null);
    try {
      const note =
        status === "problem" ? problemDrafts[check.id] ?? check.problem_note ?? "" : undefined;
      await updateRiderCheck(check.id, { status, problem_note: note ?? null });
      if (selectedEventId != null) await loadBoard(selectedEventId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddManual() {
    if (selectedEventId == null || !newTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createRiderCheck(selectedEventId, { title: newTitle.trim() });
      setNewTitle("");
      await loadBoard(selectedEventId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(check: RiderCheck) {
    setBusy(true);
    setError(null);
    try {
      await deleteRiderCheck(check.id);
      if (selectedEventId != null) await loadBoard(selectedEventId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ViaPageShell
      eyebrow="Operasyon Merkezi"
      title="Rider ve Saha Kontrol"
      description="Sanatçı rider şartlarını ve sahne hazırlıklarını etkinlik bazında kontrol listesine dök, sahada tek tek işaretle."
      onBack={onBackToDashboard}
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* SOL: etkinlik listesi */}
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Etkinlikler</h2>
          <p className="mt-1 text-sm text-slate-500">
            Kontrol etmek istediğin etkinliği seç.
          </p>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Etkinlik ara..."
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-teal-300"
          />

          <div className="mt-3 space-y-2">
            {loadingEvents ? (
              <p className="px-1 py-4 text-sm text-slate-400">Yükleniyor...</p>
            ) : filteredEvents.length === 0 ? (
              <p className="px-1 py-4 text-sm text-slate-400">
                Etkinlik bulunamadı.
              </p>
            ) : (
              eventPaging.pageItems.map((event) => {
                const active = event.id === selectedEventId;
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="truncate text-sm font-black text-slate-950">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatDate(event.event_date)}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <Pagination
            className="mt-4"
            page={eventPaging.page}
            totalPages={eventPaging.totalPages}
            onChange={eventPaging.setPage}
            total={eventPaging.total}
            rangeStart={eventPaging.rangeStart}
            rangeEnd={eventPaging.rangeEnd}
          />
        </aside>

        {/* SAĞ: kontrol panosu */}
        <section className="space-y-5">
          {error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
          {info ? (
            <div className="rounded-3xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">
              {info}
            </div>
          ) : null}

          {selectedEventId == null ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Soldan bir etkinlik seç.
            </div>
          ) : loadingBoard || !board ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
              Kontrol listesi yükleniyor...
            </div>
          ) : (
            <>
              {/* Özet + üret */}
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-300">
                      Saha Kontrol Panosu
                    </p>
                    <h2 className="mt-1 truncate text-2xl font-black">
                      {board.event_title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {formatDate(board.event_date)} ·{" "}
                      {board.artists.length} sanatçı
                    </p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={busy}
                    className="rounded-full bg-teal-300 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-teal-200 disabled:opacity-60"
                  >
                    Şablondan Üret
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <SummaryChip label="Toplam" value={board.summary.total} tone="slate" />
                  <SummaryChip label="Tamam" value={board.summary.done} tone="emerald" />
                  <SummaryChip label="Sorunlu" value={board.summary.problem} tone="red" />
                  <SummaryChip label="Bekliyor" value={board.summary.pending} tone="amber" />
                </div>

                {board.summary.required_total > 0 ? (
                  <p className="mt-4 text-sm font-semibold text-slate-300">
                    Zorunlu maddeler: {board.summary.required_done}/
                    {board.summary.required_total}{" "}
                    {board.summary.all_required_done ? "✓ tamamlandı" : "— eksik var"}
                  </p>
                ) : null}
              </div>

              {/* Elle ekle */}
              <div className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleAddManual();
                  }}
                  placeholder="Elle kontrol maddesi ekle (ör. Jeneratör yedeği)"
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-teal-300"
                />
                <button
                  onClick={handleAddManual}
                  disabled={busy || !newTitle.trim()}
                  className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Ekle
                </button>
              </div>

              {/* Liste */}
              {board.items.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Henüz kontrol maddesi yok. "Şablondan Üret" ile sanatçı rider
                  şartlarından otomatik liste oluşturabilirsin.
                </div>
              ) : (
                <div className="space-y-3">
                  {checkPaging.pageItems.map((check) => (
                    <RiderCheckRow
                      key={check.id}
                      check={check}
                      busy={busy}
                      problemDraft={problemDrafts[check.id] ?? check.problem_note ?? ""}
                      onProblemDraftChange={(value) =>
                        setProblemDrafts((prev) => ({ ...prev, [check.id]: value }))
                      }
                      onStatus={(status) => handleStatus(check, status)}
                      onDelete={() => handleDelete(check)}
                    />
                  ))}

                  <Pagination
                    className="pt-2"
                    page={checkPaging.page}
                    totalPages={checkPaging.totalPages}
                    onChange={checkPaging.setPage}
                    total={checkPaging.total}
                    rangeStart={checkPaging.rangeStart}
                    rangeEnd={checkPaging.rangeEnd}
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </ViaPageShell>
  );
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "red" | "amber";
}) {
  const toneClass = {
    slate: "bg-white/10 text-white",
    emerald: "bg-emerald-400/20 text-emerald-200",
    red: "bg-red-400/20 text-red-200",
    amber: "bg-amber-300/20 text-amber-100",
  }[tone];

  return (
    <div className={`rounded-2xl px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function RiderCheckRow({
  check,
  busy,
  problemDraft,
  onProblemDraftChange,
  onStatus,
  onDelete,
}: {
  check: RiderCheck;
  busy: boolean;
  problemDraft: string;
  onProblemDraftChange: (value: string) => void;
  onStatus: (status: RiderCheckStatus) => void;
  onDelete: () => void;
}) {
  const borderTone =
    check.status === "done"
      ? "border-emerald-200 bg-emerald-50"
      : check.status === "problem"
        ? "border-red-200 bg-red-50"
        : "border-slate-200 bg-white";

  return (
    <article className={`rounded-3xl border p-4 shadow-sm ${borderTone}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black text-slate-950">{check.title}</h3>
            {check.is_required ? (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                Zorunlu
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {STATUS_LABEL[check.status]}
            </span>
          </div>
          {check.artist_name ? (
            <p className="mt-1 text-xs font-semibold text-teal-700">
              {check.artist_name}
            </p>
          ) : null}
          {check.description ? (
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {check.description}
            </p>
          ) : null}
          {check.status === "done" && check.checked_by_name ? (
            <p className="mt-1 text-xs text-slate-400">
              İşaretleyen: {check.checked_by_name}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => onStatus("done")}
            disabled={busy}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition disabled:opacity-50 ${
              check.status === "done"
                ? "bg-emerald-500 text-white"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            Tamam
          </button>
          <button
            onClick={() => onStatus("problem")}
            disabled={busy}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition disabled:opacity-50 ${
              check.status === "problem"
                ? "bg-red-500 text-white"
                : "bg-red-100 text-red-700 hover:bg-red-200"
            }`}
          >
            Sorun
          </button>
          <button
            onClick={() => onStatus("pending")}
            disabled={busy}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
          >
            Geri Al
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            title="Sil"
            className="rounded-full px-2 py-1.5 text-xs font-black text-slate-400 transition hover:text-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      </div>

      {check.status === "problem" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={problemDraft}
            onChange={(event) => onProblemDraftChange(event.target.value)}
            placeholder="Sorun notu (ör. sahne mikrofonu eksik)"
            className="flex-1 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm outline-none focus:border-red-400"
          />
          <button
            onClick={() => onStatus("problem")}
            disabled={busy}
            className="rounded-full bg-red-500 px-4 py-2 text-sm font-black text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            Notu Kaydet
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default RiderControlPage;
