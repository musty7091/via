import { FormEvent, useEffect, useMemo, useState } from "react";

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
  currency: string;
  exchangeRate: string;
  notes: string;
};

type CollectionFormState = {
  paymentPlanId: string;
  receivedByPartnerId: string;
  collectionDate: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  paymentMethod: string;
  documentNo: string;
  notes: string;
};

const currencyOptions = ["TRY", "EUR", "GBP", "USD"];

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
    currency: event.agreement_currency,
    exchangeRate: "1",
    notes: "",
  };
}

function defaultCollectionForm(event: EventListItem): CollectionFormState {
  return {
    paymentPlanId: "",
    receivedByPartnerId: "",
    collectionDate: todayIso(),
    amount: "",
    currency: event.agreement_currency,
    exchangeRate: "1",
    paymentMethod: "cash",
    documentNo: "",
    notes: "",
  };
}

export function EventPaymentsPanel({ event }: EventPaymentsPanelProps) {
  const [payments, setPayments] = useState<EventPaymentsDetail | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
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

  async function handleCreatePlan(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();

    const amount = Number(planForm.amount);
    const exchangeRate = Number(planForm.exchangeRate || 1);

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
        currency: planForm.currency,
        exchange_rate: exchangeRate,
        notes: planForm.notes.trim() || null,
      });

      setPlanForm(defaultPlanForm(event));
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
    const exchangeRate = Number(collectionForm.exchangeRate || 1);

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
        currency: collectionForm.currency,
        exchange_rate: exchangeRate,
        payment_method: collectionForm.paymentMethod,
        document_no: collectionForm.documentNo.trim() || null,
        notes: collectionForm.notes.trim() || null,
      });

      setCollectionForm(defaultCollectionForm(event));
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
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            Ödeme Planı ve Tahsilatlar
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Etkinlik anlaşma bedelinin planlanan ve tahsil edilen kısmını buradan
            takip et.
          </p>
        </div>

        <button
          onClick={() => void loadPayments()}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white"
        >
          Yenile
        </button>
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
          <div className="mt-4 grid gap-3 md:grid-cols-4">
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
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-black text-slate-950">
                Ödeme Planı Ekle
              </h4>

              <form onSubmit={handleCreatePlan} className="mt-4 grid gap-3">
                <input
                  value={planForm.title}
                  onChange={(formEvent) =>
                    setPlanForm((current) => ({
                      ...current,
                      title: formEvent.target.value,
                    }))
                  }
                  placeholder="Kapora / Ara ödeme / Kalan ödeme"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    value={planForm.dueDate}
                    onChange={(formEvent) =>
                      setPlanForm((current) => ({
                        ...current,
                        dueDate: formEvent.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.amount}
                    onChange={(formEvent) =>
                      setPlanForm((current) => ({
                        ...current,
                        amount: formEvent.target.value,
                      }))
                    }
                    placeholder="Tutar"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={planForm.currency}
                    onChange={(formEvent) =>
                      setPlanForm((current) => ({
                        ...current,
                        currency: formEvent.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-teal-500 transition focus:ring-4"
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={planForm.exchangeRate}
                    onChange={(formEvent) =>
                      setPlanForm((current) => ({
                        ...current,
                        exchangeRate: formEvent.target.value,
                      }))
                    }
                    placeholder="Kur"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                  />
                </div>

                <textarea
                  value={planForm.notes}
                  onChange={(formEvent) =>
                    setPlanForm((current) => ({
                      ...current,
                      notes: formEvent.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Not"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                />

                <button
                  type="submit"
                  disabled={isSavingPlan}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingPlan ? "Kaydediliyor..." : "Ödeme Planı Ekle"}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="text-base font-black text-slate-950">
                Tahsilat Kaydı Ekle
              </h4>

              <form onSubmit={handleCreateCollection} className="mt-4 grid gap-3">
                <select
                  value={collectionForm.paymentPlanId}
                  onChange={(formEvent) =>
                    setCollectionForm((current) => ({
                      ...current,
                      paymentPlanId: formEvent.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-teal-500 transition focus:ring-4"
                >
                  <option value="">Ödeme planına bağlama</option>
                  {payments.payment_plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title} - {formatMoney(plan.amount, plan.currency)}
                    </option>
                  ))}
                </select>

                <select
                  value={collectionForm.receivedByPartnerId}
                  onChange={(formEvent) =>
                    setCollectionForm((current) => ({
                      ...current,
                      receivedByPartnerId: formEvent.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-teal-500 transition focus:ring-4"
                >
                  <option value="">Tahsilatı şirket aldı</option>
                  {activePartners.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.full_name}
                    </option>
                  ))}
                </select>

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    value={collectionForm.collectionDate}
                    onChange={(formEvent) =>
                      setCollectionForm((current) => ({
                        ...current,
                        collectionDate: formEvent.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={collectionForm.amount}
                    onChange={(formEvent) =>
                      setCollectionForm((current) => ({
                        ...current,
                        amount: formEvent.target.value,
                      }))
                    }
                    placeholder="Tahsilat tutarı"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={collectionForm.currency}
                    onChange={(formEvent) =>
                      setCollectionForm((current) => ({
                        ...current,
                        currency: formEvent.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-teal-500 transition focus:ring-4"
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={collectionForm.exchangeRate}
                    onChange={(formEvent) =>
                      setCollectionForm((current) => ({
                        ...current,
                        exchangeRate: formEvent.target.value,
                      }))
                    }
                    placeholder="Kur"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                  />

                  <select
                    value={collectionForm.paymentMethod}
                    onChange={(formEvent) =>
                      setCollectionForm((current) => ({
                        ...current,
                        paymentMethod: formEvent.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none ring-teal-500 transition focus:ring-4"
                  >
                    {paymentMethodOptions.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  value={collectionForm.documentNo}
                  onChange={(formEvent) =>
                    setCollectionForm((current) => ({
                      ...current,
                      documentNo: formEvent.target.value,
                    }))
                  }
                  placeholder="Belge / dekont no"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                />

                <textarea
                  value={collectionForm.notes}
                  onChange={(formEvent) =>
                    setCollectionForm((current) => ({
                      ...current,
                      notes: formEvent.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Tahsilat notu"
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
                />

                <button
                  type="submit"
                  disabled={isSavingCollection}
                  className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingCollection ? "Kaydediliyor..." : "Tahsilat Kaydet"}
                </button>
              </form>
            </section>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <PaymentPlanList plans={payments.payment_plans} />
            <CollectionList
              collections={payments.collections}
              plans={payments.payment_plans}
              partners={partners}
              onCancelCollection={handleCancelCollection}
            />
          </div>

          {activeCollections.length === 0 && payments.collections.length > 0 ? (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
              Bu etkinlikte tahsilat kayıtları var fakat aktif tahsilat yok. Kayıtlar
              iptal edilmiş görünüyor.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function LightMetric({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function PaymentPlanList({ plans }: { plans: PaymentPlan[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4">
      <h4 className="text-base font-black text-slate-950">Ödeme Planı</h4>

      {plans.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          Henüz ödeme planı yok.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
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
                  label="Tahsil edilen baz"
                  value={formatMoney(plan.paid_base_amount, "TRY")}
                />
                <InlineAmount
                  label="Baz tutar"
                  value={formatMoney(plan.base_amount, "TRY")}
                  strong
                />
              </div>

              {plan.notes ? (
                <p className="mt-3 text-sm leading-6 text-slate-500">{plan.notes}</p>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-4">
      <h4 className="text-base font-black text-slate-950">Tahsilatlar</h4>

      {collections.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
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
                    ? "border-red-100 bg-red-50"
                    : "border-slate-200 bg-slate-50"
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
                    label="Baz tutar"
                    value={formatMoney(collection.base_amount, "TRY")}
                    strong
                  />
                  <InlineAmount
                    label="Plan bağlantısı"
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
