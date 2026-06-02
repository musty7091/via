import { FormEvent, useEffect, useMemo, useState } from "react";

import { createPartner, fetchPartners, updatePartner } from "../api/partnersApi";
import type { Partner } from "../types/partnerTypes";

type PartnersPageProps = {
  onBackToDashboard: () => void;
};

type PartnerFormState = {
  fullName: string;
  ownershipPercent: string;
  isActive: boolean;
  notes: string;
};

const emptyForm: PartnerFormState = {
  fullName: "",
  ownershipPercent: "33.3333",
  isActive: true,
  notes: "",
};

function formatPercent(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function PartnersPage({ onBackToDashboard }: PartnersPageProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [form, setForm] = useState<PartnerFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.id === selectedPartnerId) ?? null,
    [partners, selectedPartnerId]
  );

  const activeOwnershipTotal = useMemo(
    () =>
      partners
        .filter((partner) => partner.is_active)
        .reduce((total, partner) => total + Number(partner.ownership_percent || 0), 0),
    [partners]
  );

  async function loadPartners(nextSelectedId?: number | null) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchPartners();
      setPartners(data);

      if (typeof nextSelectedId === "number") {
        setSelectedPartnerId(nextSelectedId);
      } else if (nextSelectedId === null) {
        setSelectedPartnerId(null);
      } else if (!selectedPartnerId && data.length > 0) {
        setSelectedPartnerId(data[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ortak listesi alınamadı."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function fillForm(partner: Partner | null) {
    if (!partner) {
      setForm(emptyForm);
      return;
    }

    setForm({
      fullName: partner.full_name,
      ownershipPercent: String(partner.ownership_percent),
      isActive: partner.is_active,
      notes: partner.notes ?? "",
    });
  }

  function startCreatePartner() {
    setSelectedPartnerId(null);
    fillForm(null);
    setSuccessMessage("");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fullName = form.fullName.trim();
    const ownershipPercent = Number(form.ownershipPercent || 0);

    if (!fullName) {
      setErrorMessage("Ortak adı boş bırakılamaz.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (selectedPartner) {
        const updated = await updatePartner(selectedPartner.id, {
          full_name: fullName,
          ownership_percent: ownershipPercent,
          is_active: form.isActive,
          notes: form.notes.trim() || null,
        });

        await loadPartners(updated.id);
        setSuccessMessage("Ortak bilgileri güncellendi.");
      } else {
        const created = await createPartner({
          full_name: fullName,
          ownership_percent: ownershipPercent,
          is_active: form.isActive,
          notes: form.notes.trim() || null,
        });

        await loadPartners(created.id);
        setSuccessMessage("Yeni ortak kaydı oluşturuldu.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ortak kaydı güncellenemedi."
      );
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    void loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fillForm(selectedPartner);
  }, [selectedPartner]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-teal-700">
              VIA EVENTS
            </p>
            <h1 className="mt-1 truncate text-xl font-black sm:text-2xl">
              Ortaklar Yönetimi
            </h1>
          </div>

          <button
            onClick={onBackToDashboard}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
          >
            Dashboard
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        <section className="rounded-[2rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-300">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
            Finans Omurgası
          </p>
          <h2 className="mt-2 text-3xl font-black">3 ortak kuralı burada yönetilir.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Tahsilatı yapan ortak, ay sonu ortak hesabı ve kârlılık paylaşımı için
            ortak isimlerinin doğru olması gerekir.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Metric title="Toplam Ortak" value={String(partners.length)} />
            <Metric
              title="Aktif Ortak"
              value={String(partners.filter((partner) => partner.is_active).length)}
            />
            <Metric
              title="Aktif Pay Toplamı"
              value={`%${formatPercent(activeOwnershipTotal)}`}
              tone={
                Math.abs(activeOwnershipTotal - 100) <= 0.05
                  ? "normal"
                  : "warning"
              }
            />
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-3xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">
            {successMessage}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">Ortaklar</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Listeyi seçerek düzenleyebilirsin.
                </p>
              </div>

              <button
                onClick={startCreatePartner}
                className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950"
              >
                Yeni
              </button>
            </div>

            {isLoading ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Ortaklar yükleniyor...
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {partners.map((partner) => (
                  <button
                    key={partner.id}
                    onClick={() => {
                      setSelectedPartnerId(partner.id);
                      setSuccessMessage("");
                      setErrorMessage("");
                    }}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      selectedPartnerId === partner.id
                        ? "border-teal-300 bg-teal-50"
                        : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">
                          {partner.full_name}
                        </p>
                        <p className="mt-1 text-sm font-bold text-teal-700">
                          %{formatPercent(partner.ownership_percent)}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          partner.is_active
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {partner.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </div>

                    {partner.notes ? (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        {partner.notes}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
                {selectedPartner ? "Düzenle" : "Yeni Ortak"}
              </p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">
                {selectedPartner ? selectedPartner.full_name : "Yeni ortak kaydı"}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Ortak adı</span>
                <input
                  value={form.fullName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                  placeholder="Ortak adı ve soyadı"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Ortaklık payı %
                </span>
                <input
                  type="number"
                  step="0.0001"
                  value={form.ownershipPercent}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      ownershipPercent: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
                Aktif ortak
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">Not</span>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal-500 transition focus:ring-4"
                  placeholder="İsteğe bağlı not"
                />
              </label>

              {Math.abs(activeOwnershipTotal - 100) > 0.05 ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Aktif ortakların toplam payı şu anda %{formatPercent(activeOwnershipTotal)}.
                  Ay sonu dağıtım ve ortak kârlılığı için toplamın %100 olması önerilir.
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Kaydediliyor..."
                  : selectedPartner
                    ? "Ortağı Güncelle"
                    : "Ortak Oluştur"}
              </button>
            </form>
          </section>
        </section>
      </section>
    </main>
  );
}

function Metric({
  title,
  value,
  tone = "normal",
}: {
  title: string;
  value: string;
  tone?: "normal" | "warning";
}) {
  return (
    <article
      className={`rounded-3xl p-4 ${
        tone === "warning" ? "bg-amber-100 text-amber-950" : "bg-white/10"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">
        {title}
      </p>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </article>
  );
}
