import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchPartners } from "../../partners/api/partnersApi";
import type { Partner } from "../../partners/types/partnerTypes";
import {
  cancelCollection,
  createCollection,
  createPaymentPlan,
  fetchEventPayments,
} from "../api/eventPaymentsApi";
import type {
  EventCollection,
  EventPaymentsDetail,
  PaymentPlan,
} from "../types/eventPaymentTypes";
import type { EventListItem } from "../types/eventTypes";
import { formatDate, formatMoney } from "./formatters";

type EventPaymentsPanelProps = {
  event: EventListItem;
};

type PlanFormState = {
  title: string;
  dueDate: string;
  amount: string;
  notes: string;
};

type CollectionFormState = {
  paymentPlanId: string;
  receivedByPartnerId: string;
  collectionDate: string;
  amount: string;
  paymentMethod: string;
  documentNo: string;
  notes: string;
};

type ActiveModal = "plan" | "collection" | null;

const paymentMethodOptions = [
  { value: "cash", label: "Nakit" },
  { value: "bank", label: "Banka" },
  { value: "card", label: "Kart" },
  { value: "other", label: "Diğer" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultPlanForm(event: EventListItem): PlanFormState {
  return {
    title: "Kapora",
    dueDate: event.event_date || todayIso(),
    amount: "",
    notes: "",
  };
}

function defaultCollectionForm(event: EventListItem): CollectionFormState {
  return {
    paymentPlanId: "",
    receivedByPartnerId: "",
    collectionDate: todayIso(),
    amount: "",
    paymentMethod: "cash",
    documentNo: "",
    notes: "",
  };
}

export function EventPaymentsPanel({ event }: EventPaymentsPanelProps) {
  const [payments, setPayments] = useState<EventPaymentsDetail | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(() =>
    defaultPlanForm(event)
  );
  const [collectionForm, setCollectionForm] = useState<CollectionFormState>(() =>
    defaultCollectionForm(event)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const activePartners = useMemo(
    () => partners.filter((partner) => partner.is_active),
    [partners]
  );

  const activeCollections = useMemo(
    () => payments?.collections.filter((collection) => !collection.is_cancelled) ?? [],
    [payments]
  );

  const nextPendingPlan = useMemo(() => {
    return payments?.payment_plans.find((plan) => plan.status !== "paid") ?? null;
  }, [payments]);

  async function loadPayments() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [paymentData, partnerData] = await Promise.all([
        fetchEventPayments(event.id),
        fetchPartners().catch(() => []),
      ]);

      setPayments(paymentData);
      setPartners(partnerData);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ödeme ve tahsilat bilgileri alınamadı."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function openPlanModal() {
    setPlanForm(defaultPlanForm(event));
    setErrorMessage("");
    setSuccessMessage("");
    setActiveModal("plan");
  }

  function openCollectionModal(plan?: PaymentPlan) {
    setCollectionForm({
      ...defaultCollectionForm(event),
      paymentPlanId: plan ? String(plan.id) : nextPendingPlan ? String(nextPendingPlan.id) : "",
      amount: plan
        ? String(Math.max(plan.base_amount - plan.paid_base_amount, 0))
        : "",
    });
    setErrorMessage("");
    setSuccessMessage("");
    setActiveModal("collection");
  }

  function closeModal() {
    if (isSavingPlan || isSavingCollection) {
      return;
    }

    setActiveModal(null);
  }

  async function handleCreatePlan(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();

    const amount = Number(planForm.amount);

    if (!planForm.title.trim() || !planForm.dueDate || !amount || amount <= 0) {
      setErrorMessage("Ödeme planı için başlık, vade tarihi ve tutar zorunludur.");
      return;
    }

    setIsSavingPlan(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createPaymentPlan(event.id, {
        title: planForm.title.trim(),
        due_date: planForm.dueDate,
        amount,
        currency: event.agreement_currency,
        exchange_rate: 1,
        notes: planForm.notes.trim() || null,
      });

      setPlanForm(defaultPlanForm(event));
      setActiveModal(null);
      await loadPayments();
      setSuccessMessage("Ödeme planı satırı oluşturuldu.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ödeme planı oluşturulamadı."
      );
    } finally {
      setIsSavingPlan(false);
    }
  }

  async function handleCreateCollection(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();

    const amount = Number(collectionForm.amount);

    if (!collectionForm.collectionDate || !amount || amount <= 0) {
      setErrorMessage("Tahsilat için tarih ve tutar zorunludur.");
      return;
    }

    setIsSavingCollection(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createCollection(event.id, {
        payment_plan_id: collectionForm.paymentPlanId
          ? Number(collectionForm.paymentPlanId)
          : null,
        received_by_partner_id: collectionForm.receivedByPartnerId
          ? Number(collectionForm.receivedByPartnerId)
          : null,
        collection_date: collectionForm.collectionDate,
        amount,
        currency: event.agreement_currency,
        exchange_rate: 1,
        payment_method: collectionForm.paymentMethod,
        document_no: collectionForm.documentNo.trim() || null,
        notes: collectionForm.notes.trim() || null,
      });

      setCollectionForm(defaultCollectionForm(event));
      setActiveModal(null);
      await loadPayments();
      setSuccessMessage("Tahsilat kaydı oluşturuldu.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Tahsilat kaydedilemedi."
      );
    } finally {
      setIsSavingCollection(false);
    }
  }

  async function handleCancelCollection(collection: EventCollection) {
    const reason = window.prompt(
      "Tahsilat iptal nedeni nedir?",
      "Hatalı kayıt"
    );

    if (!reason || !reason.trim()) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      await cancelCollection(event.id, collection.id, {
        cancellation_reason: reason.trim(),
      });

      await loadPayments();
      setSuccessMessage("Tahsilat kaydı iptal edildi.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Tahsilat iptal edilemedi."
      );
    }
  }

  useEffect(() => {
    setPlanForm(defaultPlanForm(event));
    setCollectionForm(defaultCollectionForm(event));
    setPayments(null);
    setSuccessMessage("");
    setErrorMessage("");
    setActiveModal(null);
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
            Finans Takibi
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-950">
            Ödeme Planı ve Tahsilatlar
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Bu alanda ana ekranda sadece özet, ödeme planı ve tahsilatlar görünür.
            Yeni işlem yapmak için sağdaki butonları kullan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openPlanModal}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
          >
            + Ödeme Planı
          </button>
          <button
            onClick={() => openCollectionModal()}
            className="rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950"
          >
            + Tahsilat Gir
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          Ödeme bilgileri yükleniyor...
        </p>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-3xl border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-800">
          {successMessage}
        </div>
      ) : null}

      {payments ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <LightMetric
              title="Anlaşma Toplamı"
              value={formatMoney(
                payments.summary.event_total_amount,
                payments.summary.event_currency
              )}
            />
            <LightMetric
              title="Planlanan"
              value={formatMoney(payments.summary.planned_base_amount, "TRY")}
            />
            <LightMetric
              title="Tahsil Edilen"
              value={formatMoney(payments.summary.collected_base_amount, "TRY")}
            />
            <LightMetric
              title="Kalan"
              value={formatMoney(payments.summary.remaining_base_amount, "TRY")}
              highlight
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <PaymentPlanList
              plans={payments.payment_plans}
              onCollectFromPlan={openCollectionModal}
            />
            <CollectionList
              collections={payments.collections}
              plans={payments.payment_plans}
              partners={partners}
              onCancelCollection={handleCancelCollection}
            />
          </div>

          {payments.payment_plans.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-teal-300 bg-teal-50 p-5">
              <p className="font-black text-teal-950">
                Bu etkinlik için henüz ödeme planı oluşturulmadı.
              </p>
              <p className="mt-2 text-sm leading-6 text-teal-900">
                Kapora, ara ödeme ve kalan ödeme satırlarını ekleyerek müşteriden
                ne zaman ne beklediğini planlayabilirsin.
              </p>
              <button
                onClick={openPlanModal}
                className="mt-4 rounded-full bg-teal-300 px-4 py-2 text-sm font-black text-slate-950"
              >
                İlk Ödeme Planını Ekle
              </button>
            </div>
          ) : null}

          {activeCollections.length === 0 && payments.collections.length > 0 ? (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Bu etkinlikte tahsilat kayıtları var fakat aktif tahsilat yok. Kayıtlar
              iptal edilmiş görünüyor.
            </p>
          ) : null}
        </>
      ) : null}

      {activeModal === "plan" ? (
        <Modal title="Ödeme Planı Ekle" onClose={closeModal}>
          <form onSubmit={handleCreatePlan} className="grid gap-4">
            <Field label="Başlık">
              <input
                value={planForm.title}
                onChange={(eventForm) =>
                  setPlanForm((current) => ({
                    ...current,
                    title: eventForm.target.value,
                  }))
                }
                placeholder="Kapora / Ara ödeme / Kalan ödeme"
                className="field-input"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vade tarihi">
                <input
                  type="date"
                  value={planForm.dueDate}
                  onChange={(eventForm) =>
                    setPlanForm((current) => ({
                      ...current,
                      dueDate: eventForm.target.value,
                    }))
                  }
                  className="field-input"
                />
              </Field>

              <Field label={`Tutar (${event.agreement_currency})`}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={planForm.amount}
                  onChange={(eventForm) =>
                    setPlanForm((current) => ({
                      ...current,
                      amount: eventForm.target.value,
                    }))
                  }
                  placeholder="Örn. 100000"
                  className="field-input"
                />
              </Field>
            </div>

            <Field label="Not">
              <textarea
                value={planForm.notes}
                onChange={(eventForm) =>
                  setPlanForm((current) => ({
                    ...current,
                    notes: eventForm.target.value,
                  }))
                }
                rows={3}
                placeholder="İsteğe bağlı not"
                className="field-input"
              />
            </Field>

            {event.agreement_currency !== "TRY" ? (
              <p className="rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                Bu etkinlik {event.agreement_currency} para biriminde. Kur olarak
                etkinlikte kayıtlı kur kullanılacak.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSavingPlan}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingPlan ? "Kaydediliyor..." : "Ödeme Planını Kaydet"}
            </button>
          </form>
        </Modal>
      ) : null}

      {activeModal === "collection" ? (
        <Modal title="Tahsilat Gir" onClose={closeModal}>
          <form onSubmit={handleCreateCollection} className="grid gap-4">
            <Field label="Bağlı ödeme planı">
              <select
                value={collectionForm.paymentPlanId}
                onChange={(eventForm) =>
                  setCollectionForm((current) => ({
                    ...current,
                    paymentPlanId: eventForm.target.value,
                  }))
                }
                className="field-input"
              >
                <option value="">Plansız tahsilat</option>
                {payments?.payment_plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} - {formatMoney(plan.amount, plan.currency)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tahsilat tarihi">
                <input
                  type="date"
                  value={collectionForm.collectionDate}
                  onChange={(eventForm) =>
                    setCollectionForm((current) => ({
                      ...current,
                      collectionDate: eventForm.target.value,
                    }))
                  }
                  className="field-input"
                />
              </Field>

              <Field label={`Tutar (${event.agreement_currency})`}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectionForm.amount}
                  onChange={(eventForm) =>
                    setCollectionForm((current) => ({
                      ...current,
                      amount: eventForm.target.value,
                    }))
                  }
                  placeholder="Tahsilat tutarı"
                  className="field-input"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tahsilatı alan">
                <select
                  value={collectionForm.receivedByPartnerId}
                  onChange={(eventForm) =>
                    setCollectionForm((current) => ({
                      ...current,
                      receivedByPartnerId: eventForm.target.value,
                    }))
                  }
                  className="field-input"
                >
                  <option value="">Şirket</option>
                  {activePartners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Yöntem">
                <select
                  value={collectionForm.paymentMethod}
                  onChange={(eventForm) =>
                    setCollectionForm((current) => ({
                      ...current,
                      paymentMethod: eventForm.target.value,
                    }))
                  }
                  className="field-input"
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Belge / dekont no">
              <input
                value={collectionForm.documentNo}
                onChange={(eventForm) =>
                  setCollectionForm((current) => ({
                    ...current,
                    documentNo: eventForm.target.value,
                  }))
                }
                placeholder="İsteğe bağlı"
                className="field-input"
              />
            </Field>

            <Field label="Not">
              <textarea
                value={collectionForm.notes}
                onChange={(eventForm) =>
                  setCollectionForm((current) => ({
                    ...current,
                    notes: eventForm.target.value,
                  }))
                }
                rows={3}
                placeholder="Tahsilat notu"
                className="field-input"
              />
            </Field>

            {event.agreement_currency !== "TRY" ? (
              <p className="rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                Bu etkinlik {event.agreement_currency} para biriminde. Kur olarak
                etkinlikte kayıtlı kur kullanılacak.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSavingCollection}
              className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingCollection ? "Kaydediliyor..." : "Tahsilatı Kaydet"}
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function LightMetric({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-4 ${
        highlight
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function PaymentPlanList({
  plans,
  onCollectFromPlan,
}: {
  plans: PaymentPlan[];
  onCollectFromPlan: (plan: PaymentPlan) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-black text-slate-950">Ödeme Planı</h4>
          <p className="mt-1 text-sm text-slate-500">
            Müşteriden beklenen ödeme takvimi.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
          {plans.length} kayıt
        </span>
      </div>

      {plans.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">
          Henüz ödeme planı yok.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-3xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{plan.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Vade: {formatDate(plan.due_date)}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${getPlanStatusClass(
                    plan.status
                  )}`}
                >
                  {getPlanStatusLabel(plan.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                <InlineAmount
                  label="Planlanan"
                  value={formatMoney(plan.amount, plan.currency)}
                />
                <InlineAmount
                  label="Tahsil edilen"
                  value={formatMoney(plan.paid_base_amount, "TRY")}
                />
                <InlineAmount
                  label="Kalan"
                  value={formatMoney(Math.max(plan.base_amount - plan.paid_base_amount, 0), "TRY")}
                  strong
                />
              </div>

              {plan.notes ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">{plan.notes}</p>
              ) : null}

              {plan.status !== "paid" ? (
                <button
                  onClick={() => onCollectFromPlan(plan)}
                  className="mt-4 rounded-full bg-teal-300 px-4 py-2 text-xs font-black text-slate-950"
                >
                  Bu Plana Tahsilat Gir
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CollectionList({
  collections,
  plans,
  partners,
  onCancelCollection,
}: {
  collections: EventCollection[];
  plans: PaymentPlan[];
  partners: Partner[];
  onCancelCollection: (collection: EventCollection) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-black text-slate-950">Tahsilatlar</h4>
          <p className="mt-1 text-sm text-slate-500">
            Gerçekleşen para girişleri.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
          {collections.length} kayıt
        </span>
      </div>

      {collections.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-500">
          Henüz tahsilat kaydı yok.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {collections.map((collection) => {
            const plan = plans.find((item) => item.id === collection.payment_plan_id);
            const partner = partners.find(
              (item) => item.id === collection.received_by_partner_id
            );

            return (
              <article
                key={collection.id}
                className={`rounded-3xl border p-4 ${
                  collection.is_cancelled
                    ? "border-red-100 bg-red-50 opacity-75"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">
                      {formatMoney(collection.amount, collection.currency)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(collection.collection_date)} •{" "}
                      {getPaymentMethodLabel(collection.payment_method)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      collection.is_cancelled
                        ? "bg-red-100 text-red-700"
                        : "bg-teal-100 text-teal-800"
                    }`}
                  >
                    {collection.is_cancelled ? "İptal" : "Aktif"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm">
                  <InlineAmount
                    label="Plan"
                    value={plan?.title ?? "Plansız tahsilat"}
                  />
                  <InlineAmount
                    label="Tahsilatı alan"
                    value={partner?.full_name ?? "Şirket"}
                  />
                  <InlineAmount
                    label="Belge no"
                    value={collection.document_no ?? "-"}
                  />
                </div>

                {collection.notes ? (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {collection.notes}
                  </p>
                ) : null}

                {collection.cancellation_reason ? (
                  <p className="mt-3 rounded-2xl bg-white/80 p-3 text-sm leading-6 text-red-700">
                    İptal nedeni: {collection.cancellation_reason}
                  </p>
                ) : null}

                {!collection.is_cancelled ? (
                  <button
                    onClick={() => onCancelCollection(collection)}
                    className="mt-4 rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white"
                  >
                    Tahsilatı İptal Et
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl shadow-slate-950/30">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-teal-700">
              Finans İşlemi
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{title}</h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
          >
            Kapat
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function InlineAmount({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-black text-slate-950" : "font-bold text-slate-700"}>
        {value}
      </span>
    </div>
  );
}

function getPlanStatusLabel(status: string) {
  if (status === "paid") {
    return "Ödendi";
  }

  if (status === "partial") {
    return "Kısmi";
  }

  return "Bekliyor";
}

function getPlanStatusClass(status: string) {
  if (status === "paid") {
    return "bg-teal-100 text-teal-800";
  }

  if (status === "partial") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-slate-200 text-slate-600";
}

function getPaymentMethodLabel(method: string) {
  return paymentMethodOptions.find((option) => option.value === method)?.label ?? method;
}
