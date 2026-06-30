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

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function CustomerLedger({
  ledger,
  onCreateMovement,
}: CustomerLedgerProps) {
  const [movementDate, setMovementDate] = useState(getTodayInputValue());
  const [movementType, setMovementType] = useState("");
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [collectedByPartnerId, setCollectedByPartnerId] = useState("");
  const [detailNote, setDetailNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!movementType || !title.trim() || !amount) {
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
        amount: Number(amount),
        base_amount: Number(amount),
        currency: "TRY",
        exchange_rate: 1,
        payment_method: paymentMethod || null,
        collected_by_partner_id: collectedByPartnerId
          ? Number(collectedByPartnerId)
          : null,
        detail_note: detailNote.trim() || null,
      });

      setMovementDate(getTodayInputValue());
      setMovementType("");
      setTitle("");
      setDescription("");
      setAmount("");
      setPaymentMethod("");
      setCollectedByPartnerId("");
      setDetailNote("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-slate-950">
            Cari Hareketler (Ledger)
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Müşteriye ait serbest borç ve alacak kayıtları.
          </p>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_2fr]">
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={movementDate}
              onChange={(event) => setMovementDate(event.target.value)}
              required
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <select
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value as "debit" | "credit")
              }
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              <option value="debit">Müşteriye Borç Yaz (+)</option>
              <option value="credit">Müşteriden Tahsil Et (-)</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,1.5fr)]">
            <select
              value={movementType}
              onChange={(event) => setMovementType(event.target.value)}
              required
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            >
              <option value="">Hareket Türü Seç</option>
              {ledgerMovementTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="İşlem başlığı"
              required
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Açıklama (opsiyonel)"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />

            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Tutar (₺)"
              min="0"
              step="0.01"
              required
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-teal-500 transition focus:ring-4"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSaving ? "İşleniyor..." : "Hareketi Ekle"}
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="hidden grid-cols-[100px_minmax(0,1fr)_120px] gap-4 bg-slate-50 px-4 py-3 text-[10px] font-medium uppercase tracking-widest text-slate-400 sm:grid">
            <span>Tarih / Tür</span>
            <span>Açıklama</span>
            <span className="text-right">Tutar</span>
          </div>

          {ledger.length === 0 ? (
            <div className="p-6 text-center text-sm font-medium text-slate-500">
              Henüz cari hareket yok.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {ledger.map((movement) => (
                <div
                  key={movement.id}
                  className="grid gap-3 bg-white p-4 sm:grid-cols-[100px_minmax(0,1fr)_120px]"
                >
                  <div className="self-center">
                    <p className="text-[11px] font-medium text-slate-500">
                      {formatDate(movement.movement_date)}
                    </p>
                    <p className="truncate text-xs font-medium text-slate-500">
                      {getOptionLabel(
                        ledgerMovementTypeOptions,
                        movement.movement_type
                      )}
                    </p>
                  </div>

                  <div className="min-w-0 self-center">
                    <p className="text-sm font-medium text-slate-950">
                      {movement.title}
                    </p>
                    {movement.description ? (
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {movement.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="self-center text-left sm:text-right">
                    <span className="text-right font-medium">
                      {movement.direction === "debit" ? (
                        <span className="text-rose-600">+ </span>
                      ) : (
                        <span className="text-emerald-600">- </span>
                      )}
                      {formatMoney(movement.base_amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
