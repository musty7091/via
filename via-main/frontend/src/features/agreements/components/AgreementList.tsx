import type {
  AgreementCustomerMap,
  AgreementListItem,
} from "../types/agreementTypes";
import { formatDate, formatMoney } from "../../offers/components/formatters";

type AgreementListProps = {
  agreements: AgreementListItem[];
  selectedAgreementId: number | null;
  customerMap: AgreementCustomerMap;
  onSelectAgreement: (agreementId: number) => void;
};

export function AgreementList({
  agreements,
  selectedAgreementId,
  customerMap,
  onSelectAgreement,
}: AgreementListProps) {
  if (agreements.length === 0) {
    return (
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black text-slate-950">
          Henüz anlaşmaya çevrilmiş teklif yok.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Teklif / Paket Hazırla ekranında bir teklifi “Anlaşmaya Çevir”
          dediğinizde burada listelenir.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {agreements.map((agreement) => {
        const isSelected = selectedAgreementId === agreement.id;
        const customer = customerMap[agreement.customer_id];

        return (
          <button
            key={agreement.id}
            type="button"
            onClick={() => onSelectAgreement(agreement.id)}
            className={`w-full rounded-[1.75rem] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              isSelected
                ? "border-teal-300 bg-teal-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                  {agreement.offer_no ?? `ANL-${agreement.id}`}
                </p>

                <h3 className="mt-2 truncate text-lg font-black text-slate-950">
                  {agreement.title}
                </h3>

                <p className="mt-1 truncate text-sm font-semibold text-slate-500">
                  {customer?.name ?? `Müşteri #${agreement.customer_id}`}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                Anlaşma
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>Etkinlik tarihi</span>
                <span className="font-black text-slate-950">
                  {formatDate(agreement.event_date)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Toplam</span>
                <span className="font-black text-slate-950">
                  {formatMoney(agreement.total_amount, agreement.currency)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span>Etkinlik ID</span>
                <span className="font-black text-slate-950">
                  {agreement.event_id ?? "-"}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}