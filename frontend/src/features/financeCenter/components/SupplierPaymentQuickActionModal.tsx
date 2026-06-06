import { useEffect, useMemo, useState } from "react";

import {
  createSupplierPayment,
  fetchArtists,
  fetchCashAccounts,
  fetchEvents,
  fetchPartners,
  fetchServiceItems,
  fetchSupplierPayables,
} from "../api/financeCenterApi";
import type {
  ArtistRead,
  CashAccountRead,
  EventRead,
  PartnerRead,
  ServiceItemRead,
  SupplierPayableRead,
} from "../types/financeCenterTypes";

type SupplierPaymentQuickActionModalProps = {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type SupplierPayableOption = {
  payable: SupplierPayableRead;
  event: EventRead;
  supplierName: string;
  supplierTypeLabel: string;
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number | string | null | undefined, currency = "TL") {
  const safeValue = Number(value ?? 0);
  return (
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue) + ` ${currency}`
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function SupplierPaymentQuickActionModal({
  onClose,
  onSaved,
}: SupplierPaymentQuickActionModalProps) {
  const [payableOptions, setPayableOptions] = useState<SupplierPayableOption[]>([]);
  const [partners, setPartners] = useState<PartnerRead[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccountRead[]>([]);
  const [selectedPayableId, setSelectedPayableId] = useState("");
  const [paymentSource, setPaymentSource] = useState<"company" | "partner">("company");
  const [selectedCashAccountId, setSelectedCashAccountId] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDate());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("TRY");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [documentNo, setDocumentNo] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadOptions() {
    setIsLoading(true);
    setError(null);

    try {
      const [events, artists, services, partnerList, cashAccountList] = await Promise.all([
        fetchEvents(),
        fetchArtists(),
        fetchServiceItems(),
        fetchPartners(),
        fetchCashAccounts(),
      ]);

      setPartners(partnerList);
      setCashAccounts(cashAccountList);

      const artistMap = new Map<number, ArtistRead>();
      artists.forEach((artist) => artistMap.set(artist.id, artist));

      const serviceMap = new Map<number, ServiceItemRead>();
      services.forEach((service) => serviceMap.set(service.id, service));

      const results = await Promise.allSettled(
        events.map(async (eventItem) => ({
          eventItem,
          detail: await fetchSupplierPayables(eventItem.id),
        }))
      );

      const options: SupplierPayableOption[] = [];

      results.forEach((result) => {
        if (result.status !== "fulfilled") {
          return;
        }

        const { eventItem, detail } = result.value;

        detail.payables
          .filter(
            (payable) =>
              (payable.status === "open" || payable.status === "partial") &&
              Number(payable.remaining_base_amount ?? 0) > 0
          )
          .forEach((payable) => {
            const isArtist = payable.artist_id !== null;
            const supplierName = isArtist
              ? artistMap.get(payable.artist_id ?? 0)?.name ?? `Sanatçı #${payable.artist_id}`
              : serviceMap.get(payable.service_item_id ?? 0)?.name ??
                `Hizmet #${payable.service_item_id}`;

            options.push({
              payable,
              event: eventItem,
              supplierName,
              supplierTypeLabel: isArtist ? "Sanatçı" : "Hizmet",
            });
          });
      });

      options.sort((left, right) => {
        const leftDate = left.payable.due_date ?? left.event.event_date ?? "";
        const rightDate = right.payable.due_date ?? right.event.event_date ?? "";
        const dateCompare = rightDate.localeCompare(leftDate);
        return dateCompare !== 0 ? dateCompare : right.payable.id - left.payable.id;
      });

      setPayableOptions(options);

      const firstOption = options[0];
      if (firstOption) {
        setSelectedPayableId(String(firstOption.payable.id));
        setPaymentAmount(String(Number(firstOption.payable.remaining_base_amount ?? 0)));
        setPaymentCurrency(firstOption.payable.currency || "TRY");
        setExchangeRate(String(Number(firstOption.payable.exchange_rate ?? 1) || 1));
      }

      const firstCashAccount = cashAccountList.find((account) => account.is_active);
      if (firstCashAccount) {
        setSelectedCashAccountId(String(firstCashAccount.id));
      }

      const firstPartner = partnerList.find((partner) => partner.is_active);
      if (firstPartner) {
        setSelectedPartnerId(String(firstPartner.id));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Açık borçlar alınamadı.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  const selectedOption = useMemo(() => {
    return payableOptions.find((option) => String(option.payable.id) === selectedPayableId) ?? null;
  }, [payableOptions, selectedPayableId]);

  function handleSelectPayable(value: string) {
    setSelectedPayableId(value);
    setError(null);

    const option = payableOptions.find((item) => String(item.payable.id) === value);

    if (option) {
      setPaymentAmount(String(Number(option.payable.remaining_base_amount ?? 0)));
      setPaymentCurrency(option.payable.currency || "TRY");
      setExchangeRate(String(Number(option.payable.exchange_rate ?? 1) || 1));
    }
  }

  async function handleSave() {
    if (!selectedOption) {
      setError("Ödenecek borç seçilmelidir.");
      return;
    }

    const amount = Number(paymentAmount);
    const rate = Number(exchangeRate);
    const remainingAmount = Number(selectedOption.payable.remaining_base_amount ?? 0);

    if (!amount || amount <= 0) {
      setError("Ödeme tutarı sıfırdan büyük olmalıdır.");
      return;
    }

    if (amount > remainingAmount) {
      setError("Ödeme tutarı kalan borçtan büyük olamaz.");
      return;
    }

    if (!rate || rate <= 0) {
      setError("Kur değeri sıfırdan büyük olmalıdır.");
      return;
    }

    if (paymentSource === "company" && !selectedCashAccountId) {
      setError("Şirket ödemesi için kasa/banka hesabı seçilmelidir.");
      return;
    }

    if (paymentSource === "partner" && !selectedPartnerId) {
      setError("Ortak ödemesi için ödeme yapan ortak seçilmelidir.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      await createSupplierPayment(selectedOption.event.id, selectedOption.payable.id, {
        cash_account_id: paymentSource === "company" ? Number(selectedCashAccountId) : null,
        paid_by_partner_id: paymentSource === "partner" ? Number(selectedPartnerId) : null,
        payment_date: paymentDate,
        amount,
        currency: paymentCurrency,
        exchange_rate: rate,
        payment_method: paymentMethod,
        document_no: documentNo.trim() || null,
        notes: paymentNotes.trim() || null,
      });

      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ödeme kaydı oluşturulamadı.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-rose-700">
              Hızlı İşlem
            </p>
            <h3 className="mt-2 text-2xl font-black">Sanatçı / Hizmet Ödemesi</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Açık sanatçı veya hizmet borcunu seçip şirket kasasından ya da ortak üzerinden
              ödeme kaydı oluşturun.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            Kapat
          </button>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-5 text-sm font-bold text-slate-500">
            Açık borçlar yükleniyor...
          </div>
        ) : null}

        {!isLoading && payableOptions.length === 0 ? (
          <div className="mt-5 rounded-[1.25rem] border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
            Ödeme bekleyen sanatçı/hizmet borcu bulunmuyor.
          </div>
        ) : null}

        {payableOptions.length > 0 ? (
          <>
            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Ödenecek Borç
              </span>
              <select
                value={selectedPayableId}
                onChange={(event) => handleSelectPayable(event.target.value)}
                disabled={isSaving}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-rose-300 disabled:opacity-60"
              >
                {payableOptions.map((option) => (
                  <option key={option.payable.id} value={option.payable.id}>
                    {option.supplierName} · {option.event.title} ·{" "}
                    {formatMoney(option.payable.remaining_base_amount, option.payable.currency)}
                  </option>
                ))}
              </select>
            </label>

            {selectedOption ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.25rem] border border-rose-100 bg-rose-50 p-4 text-rose-950">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">
                    Kalan Borç
                  </p>
                  <p className="mt-2 text-2xl font-black">
                    {formatMoney(selectedOption.payable.remaining_base_amount, selectedOption.payable.currency)}
                  </p>
                  <p className="mt-2 text-sm font-bold">{selectedOption.supplierName}</p>
                </div>
                <div className="rounded-[1.25rem] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    Etkinlik / Vade
                  </p>
                  <p className="mt-2 font-black">{selectedOption.event.title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedOption.payable.due_date ? formatDate(selectedOption.payable.due_date) : "Vade yok"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SelectField label="Ödeme Kaynağı" value={paymentSource} onChange={(value) => { setPaymentSource(value as "company" | "partner"); setError(null); }} disabled={isSaving}>
                <option value="company">Şirket kasası/bankası</option>
                <option value="partner">Ortak ödedi</option>
              </SelectField>

              {paymentSource === "company" ? (
                <SelectField label="Kasa/Banka" value={selectedCashAccountId} onChange={(value) => { setSelectedCashAccountId(value); setError(null); }} disabled={isSaving}>
                  <option value="">Kasa/banka seçin</option>
                  {cashAccounts.filter((account) => account.is_active).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.account_type === "bank" ? "Banka" : "Kasa"})
                    </option>
                  ))}
                </SelectField>
              ) : (
                <SelectField label="Ödeyen Ortak" value={selectedPartnerId} onChange={(value) => { setSelectedPartnerId(value); setError(null); }} disabled={isSaving}>
                  <option value="">Ortak seçin</option>
                  {partners.filter((partner) => partner.is_active).map((partner) => (
                    <option key={partner.id} value={partner.id}>{partner.full_name}</option>
                  ))}
                </SelectField>
              )}

              <InputField label="Ödeme Tarihi" type="date" value={paymentDate} onChange={setPaymentDate} disabled={isSaving} />
              <InputField label="Tutar" type="number" value={paymentAmount} onChange={(value) => { setPaymentAmount(value); setError(null); }} disabled={isSaving} />

              <SelectField label="Para Birimi" value={paymentCurrency} onChange={setPaymentCurrency} disabled={isSaving}>
                <option value="TRY">TL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </SelectField>

              <InputField label="Kur" type="number" value={exchangeRate} onChange={(value) => { setExchangeRate(value); setError(null); }} disabled={isSaving} />

              <SelectField label="Ödeme Şekli" value={paymentMethod} onChange={setPaymentMethod} disabled={isSaving}>
                <option value="cash">Nakit</option>
                <option value="bank">Banka</option>
                <option value="transfer">Havale / EFT</option>
                <option value="card">Kart</option>
              </SelectField>

              <InputField label="Belge No" type="text" value={documentNo} onChange={setDocumentNo} disabled={isSaving} placeholder="Opsiyonel" />
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Not
              </span>
              <textarea
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                disabled={isSaving}
                className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-rose-300 disabled:opacity-60"
                placeholder="Opsiyonel"
              />
            </label>

            <div className="mt-5 rounded-[1.25rem] border border-rose-100 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
              <strong>Muhasebe etkisi:</strong>{" "}
              {paymentSource === "company"
                ? "Şirket kasası/bankası azalır ve sanatçı/hizmet borcu kapanır."
                : "Sanatçı/hizmet borcu kapanır; şirketin ortağa borcu artar."}
            </div>
          </>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading || payableOptions.length === 0}
            className="rounded-full bg-rose-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {isSaving ? "Ödeme Kaydediliyor..." : "Ödemeyi Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-rose-300 disabled:opacity-60"
      >
        {children}
      </select>
    </label>
  );
}

function InputField({
  label,
  type,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-rose-300 disabled:opacity-60"
      />
    </label>
  );
}
