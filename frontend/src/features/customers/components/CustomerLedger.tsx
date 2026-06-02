import { FormEvent, useState } from "react";

import {
  getOptionLabel,
  ledgerMovementTypeOptions,
  paymentMethodOptions,
} from "../constants/customerConstants";
import type {
  CustomerLedgerMovement,
  CustomerLedgerMovementCreatePayload,
} from "../types/customerTypes";
import { formatDate, formatMoney } from "./formatters";

type CustomerLedgerProps = {
  ledger: CustomerLedgerMovement[];
  onCreateMovement: (payload: CustomerLedgerMovementCreatePayload) => Promise<void>;
};

export function CustomerLedger({
  ledger,
  onCreateMovement,
}: CustomerLedgerProps) {
  const [movementDate, setMovementDate] = useState("2026-06-01");
  const [movementType, setMovementType] = useState("event_charge");
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [title, setTitle] = useState("Etkinlik bedeli");
  const [description, setDescription] = useState("Frekans konseri");
  const [amount, setAmount] = useState("120000");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [collectedByPartnerId, setCollectedByPartnerId] = useState("");
  const [detailNote, setDetailNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !amount) {
      return;
    }

    setIsSaving(true);

    try {
      await onCreateMovement({
        movement_date: movementDate,
        movement_type: movementType,
        direction,
        title: title.trim(),
        description: description.trim() || null,
        detail_note: detailNote.trim() || null,
        amount: Number(amount),
        currency: "TRY",
        exchange_rate: 1,
        payment_method: paymentMethod || null,
        collected_by_partner_id: collectedByPartnerId
          ? Number(collectedByPartnerId)
          : null,
      });

      setAmount("");
      setDetailNote("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-lg font-black text-slate-950">
          Müşteri Hesap Hareketleri
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Borç, tahsilat ve kümülatif bakiye takibi.
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
        <div className="hidden grid-cols-[110px_1fr_120px_120px_120px] bg-slate-100 px-4 py-3 text-xs font-black uppercase tracking-[0.15em] text-slate-500 lg:grid">
          <span>Tarih</span>
          <span>İşlem</span>
          <span>Borç</span>
          <span>Alacak</span>
          <span>Bakiye</span>
        </div>

        {ledger.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Henüz hesap hareketi yok.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {ledger.map((movement) => (
              <article key={movement.id} className="p-4">
                <div className="grid gap-3 lg:grid-cols-[110px_1fr_120px_120px_120px] lg:items-start">
                  <div className="text-sm font-bold text-slate-600">
                    {formatDate(movement.movement_date)}
                  </div>

                  <div>
                    <p className="font-black text-slate-950">
                      {movement.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {getOptionLabel(
                        ledgerMovementTypeOptions,
                        movement.movement_type
                      )}
                      {movement.description ? ` • ${movement.description}` : ""}
                    </p>
                  </div>

                  <div className="text-sm font-black text-slate-950">
                    {movement.debit_base_amount > 0
                      ? formatMoney(movement.debit_base_amount)
                      : "-"}
                  </div>

                  <div className="text-sm font-black text-slate-950">
                    {movement.credit_base_amount > 0
                      ? formatMoney(movement.credit_base_amount)
                      : "-"}
                  </div>

                  <div className="text-sm font-black text-teal-700">
                    {formatMoney(movement.running_balance_base_amount)}
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                  <span className="font-bold text-slate-700">Detay: </span>
                  {movement.detail_note || "Açıklama yok."}
                  {movement.collected_by_partner_name
                    ? ` | Tahsilatı yapan: ${movement.collected_by_partner_name}`
                    : ""}
                  {movement.payment_method
                    ? ` | Ödeme yöntemi: ${getOptionLabel(
                        paymentMethodOptions,
                        movement.payment_method
                      )}`
                    : ""}
                  {movement.document_no
                    ? ` | Belge No: ${movement.document_no}`
                    : ""}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-800">
          Manuel hesap hareketi ekle
        </p>

        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="date"
              value={movementDate}
              onChange={(event) => setMovementDate(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <select
              value={movementType}
              onChange={(event) => setMovementType(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              {ledgerMovementTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value as "debit" | "credit")
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              <option value="debit">Borç</option>
              <option value="credit">Alacak / Tahsilat</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="İşlem başlığı"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Etkinlik / açıklama"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Tutar"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              <option value="">Ödeme yöntemi seçilmedi</option>
              {paymentMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={collectedByPartnerId}
              onChange={(event) => setCollectedByPartnerId(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              <option value="">Tahsilatı yapan ortak yok</option>
              <option value="1">Ortak 1</option>
              <option value="2">Ortak 2</option>
              <option value="3">Ortak 3</option>
            </select>
          </div>

          <textarea
            value={detailNote}
            onChange={(event) => setDetailNote(event.target.value)}
            placeholder="Satır altı detay notu"
            rows={2}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
          />

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isSaving ? "Ekleniyor..." : "Hareket Ekle"}
          </button>
        </div>
      </form>
    </section>
  );
}