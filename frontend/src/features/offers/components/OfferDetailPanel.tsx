import { useState } from "react";

import {
  getOptionLabel,
  invoiceTypeOptions,
  offerStatusOptions,
  programSectionOptions,
} from "../constants/offerConstants";
import type { OfferDetail } from "../types/offerTypes";
import { formatDate, formatMoney, formatTime } from "./formatters";

type OfferDetailPanelProps = {
  detail: OfferDetail;
  onOpenItemForm: () => void;
  onOpenEdit: () => void;
  onRemoveItem: (itemId: number) => void;
  onEditItem: (
    itemId: number,
    payload: {
      quantity: number;
      unit_price: number;
      internal_unit_cost: number;
    }
  ) => Promise<void>;
  onPrint: () => void;
  onConvertToAgreement: () => void;
  onCancelOffer: () => void;
  removingItemId: number | null;
  isConverting: boolean;
  isCancelling: boolean;
};

export function OfferDetailPanel({
  detail,
  onOpenItemForm,
  onOpenEdit,
  onRemoveItem,
  onEditItem,
  onPrint,
  onConvertToAgreement,
  onCancelOffer,
  removingItemId,
  isConverting,
  isCancelling,
}: OfferDetailPanelProps) {
  const offer = detail.offer;
  const isAgreement = offer.status === "agreement";
  const isCancelled = offer.status === "cancelled";

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit(item: {
    id: number;
    quantity: number;
    base_amount: number;
    internal_total_cost: number;
  }) {
    const unitPrice = item.quantity ? item.base_amount / item.quantity : 0;
    const unitCost = item.quantity
      ? item.internal_total_cost / item.quantity
      : 0;
    setEditingItemId(item.id);
    setEditQuantity(String(item.quantity));
    setEditUnitPrice(String(unitPrice));
    setEditUnitCost(String(unitCost));
    setEditError(null);
  }

  async function saveEdit(itemId: number) {
    setSavingEdit(true);
    setEditError(null);
    try {
      await onEditItem(itemId, {
        quantity: Number(editQuantity) || 0,
        unit_price: Number(editUnitPrice) || 0,
        internal_unit_cost: Number(editUnitCost) || 0,
      });
      setEditingItemId(null);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Kalem güncellenemedi."
      );
    } finally {
      setSavingEdit(false);
    }
  }

  const remainingPaymentAmount =
    offer.advance_payment_currency === offer.currency
      ? Math.max(offer.total_amount - offer.advance_payment_amount, 0)
      : offer.total_amount;

  const sortedItems = [...detail.items].sort(
    (firstItem, secondItem) => firstItem.sort_order - secondItem.sort_order
  );

  return (
    <section className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl shadow-slate-300">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-teal-300">
                {offer.offer_no ?? "Teklif"}
              </p>

              <h2 className="mt-3 truncate text-3xl font-black tracking-tight">
                {offer.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Etkinlik tarihi: {formatDate(offer.event_date)} • Geçerlilik:{" "}
                {formatDate(offer.valid_until)}
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-black ${
                isAgreement
                  ? "bg-teal-300 text-slate-950"
                  : isCancelled
                    ? "bg-red-400 text-white"
                    : "bg-white text-slate-950"
              }`}
            >
              {getOptionLabel(offerStatusOptions, offer.status)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <InfoPill title="Teklif no" value={offer.offer_no ?? "-"} />
            <InfoPill
              title="Fatura tipi"
              value={getOptionLabel(invoiceTypeOptions, offer.invoice_type)}
            />
            <InfoPill title="KDV oranı" value={`%${offer.vat_rate}`} />
            <InfoPill title="Para birimi" value={offer.currency} />
            <InfoPill title="Kalem sayısı" value={`${detail.items.length}`} />
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenEdit}
              disabled={isAgreement || isCancelled}
              className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Teklifi Düzenle
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            >
              Müşteri Çıktısı / PDF
            </button>

            <button
              type="button"
              onClick={onOpenItemForm}
              disabled={isAgreement || isCancelled}
              className="rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Kalem Ekle
            </button>

            <button
              type="button"
              onClick={onConvertToAgreement}
              disabled={isAgreement || isCancelled || isConverting}
              className="rounded-full bg-teal-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAgreement
                ? "Anlaşmaya Çevrildi"
                : isConverting
                  ? "Çevriliyor..."
                  : "Anlaşmaya Çevir"}
            </button>

            <button
              type="button"
              onClick={onCancelOffer}
              disabled={isAgreement || isCancelled || isCancelling}
              className="rounded-full bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelled
                ? "İptal Edildi"
                : isCancelling
                  ? "İptal Ediliyor..."
                  : "Teklifi İptal Et"}
            </button>
          </div>
        </div>
      </section>

      {offer.event_id ? (
        <section className="rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
          <p className="text-sm font-black text-teal-900">
            Etkinlik dosyası oluşturuldu.
          </p>
          <p className="mt-2 text-sm leading-6 text-teal-900">
            Bu teklif artık gerçek bir etkinlik dosyasına bağlı. Operasyon,
            ödeme, gider ve kârlılık takibi bundan sonra etkinlik üzerinden
            yürütülecek.
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-teal-800">
            Etkinlik ID: {offer.event_id}
          </p>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric
          title="Ara toplam"
          value={formatMoney(offer.amount, offer.currency)}
        />
        <Metric
          title="KDV"
          value={formatMoney(offer.vat_amount, offer.currency)}
        />
        <Metric
          title="Genel toplam"
          value={formatMoney(offer.total_amount, offer.currency)}
          strong
        />
        <Metric
          title="Ön ödeme"
          value={formatMoney(
            offer.advance_payment_amount,
            offer.advance_payment_currency
          )}
        />
        <Metric
          title="Kalan ödeme"
          value={formatMoney(remainingPaymentAmount, offer.currency)}
          strong
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-700">
              Müşteri Çıktısı
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Müşteriye Görünecek Finans Özeti
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Bu bölüm müşteri çıktısına gider. İç maliyetler burada
              gösterilmez.
            </p>
          </div>
        </div>

        {detail.visible_summaries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Müşteriye görünecek finans özeti henüz oluşmadı.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.visible_summaries.map((summary) => (
              <article
                key={summary.currency}
                className="rounded-3xl bg-slate-50 p-4"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">
                  {summary.currency}
                </p>

                <div className="mt-3 grid gap-2 text-sm">
                  <Row
                    label="Ara toplam"
                    value={formatMoney(
                      summary.visible_amount,
                      summary.currency
                    )}
                  />
                  <Row
                    label="KDV"
                    value={formatMoney(summary.vat_amount, summary.currency)}
                  />
                  <Row
                    label="Genel toplam"
                    value={formatMoney(summary.total_amount, summary.currency)}
                    strong
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">
              Teklif İçeriği
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              Teklif Satırları
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Görünür satırlar müşteriye gider. Maliyet ve kâr sütunları sadece
              Backoffice içindir.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenItemForm}
            disabled={isAgreement || isCancelled}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kalem Ekle
          </button>
        </div>

        {sortedItems.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
            Henüz teklif satırı yok.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            <div className="hidden grid-cols-[56px_minmax(0,1fr)_70px_105px_105px_105px_82px] gap-3 bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 xl:grid">
              <span>Sıra</span>
              <span>Kalem</span>
              <span>Adet</span>
              <span>Satış</span>
              <span>Maliyet</span>
              <span>Kâr</span>
              <span>Sil</span>
            </div>

            <div className="divide-y divide-slate-100">
              {sortedItems.map((item, index) => {
                const isPackageComponent =
                  item.source_type === "package_component";

                const profitText =
                  item.currency === item.internal_cost_currency
                    ? formatMoney(item.internal_profit, item.currency)
                    : "Kur gerekli";

                return (
                  <article
                    key={item.id}
                    className="grid gap-3 p-4 xl:grid-cols-[56px_minmax(0,1fr)_70px_105px_105px_105px_82px] xl:items-start"
                  >
                    <div className="text-sm font-black text-teal-700">
                      {item.sort_order || index + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-950">
                          {item.title}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                            item.is_visible_on_offer
                              ? "bg-teal-100 text-teal-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.is_visible_on_offer
                            ? "Müşteriye görünür"
                            : "İç kalem"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {getOptionLabel(
                          programSectionOptions,
                          item.program_section
                        )}
                        {item.start_time || item.end_time ? (
                          <>
                            {" "}
                            • {formatTime(item.start_time)} -{" "}
                            {formatTime(item.end_time)}
                          </>
                        ) : null}
                      </p>

                      {item.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    <Amount title="Adet" value={`${item.quantity}`} />

                    <Amount
                      title="Satış"
                      value={
                        isPackageComponent
                          ? "Paket içinde"
                          : formatMoney(item.base_amount, item.currency)
                      }
                    />

                    <Amount
                      title="Maliyet"
                      value={formatMoney(
                        item.internal_total_cost,
                        item.internal_cost_currency
                      )}
                    />

                    <Amount title="Kâr" value={profitText} />

                    <div className="flex items-start gap-2 xl:justify-end">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={
                          isAgreement || isCancelled || isPackageComponent
                        }
                        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        disabled={
                          removingItemId === item.id ||
                          isAgreement ||
                          isCancelled
                        }
                        className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingItemId === item.id ? "..." : "Kaldır"}
                      </button>
                    </div>

                    {editingItemId === item.id ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:col-span-7">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                          Kalemi düzenle
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <label className="text-sm font-bold text-slate-700">
                            Adet
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                            />
                          </label>
                          <label className="text-sm font-bold text-slate-700">
                            Birim Satış ({item.currency})
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editUnitPrice}
                              onChange={(e) => setEditUnitPrice(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                            />
                          </label>
                          <label className="text-sm font-bold text-slate-700">
                            Birim Maliyet ({item.internal_cost_currency})
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editUnitCost}
                              onChange={(e) => setEditUnitCost(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                            />
                          </label>
                        </div>
                        {editError ? (
                          <p className="mt-2 text-xs font-bold text-rose-600">
                            {editError}
                          </p>
                        ) : null}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEdit(item.id)}
                            disabled={savingEdit}
                            className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          >
                            {savingEdit ? "Kaydediliyor..." : "Kaydet"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            disabled={savingEdit}
                            className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-300 disabled:opacity-50"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-700">
              Sadece Backoffice
            </p>
            <h3 className="mt-2 text-xl font-black text-amber-950">
              İç Kârlılık Özeti
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-900">
              Bu bölüm müşteriye gitmez. Sadece gelir, maliyet ve brüt kâr
              kontrolü içindir.
            </p>
          </div>
        </div>

        {detail.internal_summaries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-amber-900">
            İç kârlılık özeti henüz oluşmadı.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.internal_summaries.map((summary) => (
              <article
                key={summary.currency}
                className="rounded-3xl bg-white p-4"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">
                  {summary.currency}
                </p>

                <div className="mt-3 grid gap-2 text-sm">
                  <Row
                    label="Gelir"
                    value={formatMoney(summary.revenue_amount, summary.currency)}
                  />
                  <Row
                    label="Maliyet"
                    value={formatMoney(summary.cost_amount, summary.currency)}
                  />
                  <Row
                    label="Brüt kâr"
                    value={formatMoney(
                      summary.gross_profit_amount,
                      summary.currency
                    )}
                    strong
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function InfoPill({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 truncate text-sm font-black text-white">{value}</p>
    </article>
  );
}

function Metric({
  title,
  value,
  strong,
}: {
  title: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border bg-white p-4 shadow-sm ${
        strong ? "border-teal-200" : "border-slate-200"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <p
        className={`mt-3 text-xl font-black ${
          strong ? "text-teal-700" : "text-slate-950"
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function Row({
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
      <span
        className={
          strong ? "font-black text-slate-950" : "font-bold text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Amount({ title, value }: { title: string; value: string }) {
  return (
    <div className="text-sm font-bold text-slate-700">
      <span className="xl:hidden">{title}: </span>
      <span className="text-slate-950">{value}</span>
    </div>
  );
}