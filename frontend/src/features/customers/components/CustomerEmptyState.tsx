import {
  customerTypeOptions,
  getOptionLabel,
} from "../constants/customerConstants";
import type { CustomerListItem } from "../types/customerTypes";

type CustomerEmptyStateProps = {
  customers: CustomerListItem[];
  onOpenSelector: () => void;
  onOpenCreatePanel: () => void;
  onSelectCustomer: (customerId: number) => void;
};

export function CustomerEmptyState({
  customers,
  onOpenSelector,
  onOpenCreatePanel,
  onSelectCustomer,
}: CustomerEmptyStateProps) {
  const suggestedCustomers = customers.slice(0, 6);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="overflow-hidden rounded-[1.5rem] bg-slate-950 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
          Müşteri Çalışma Alanı
        </p>
        <h2 className="mt-3 text-3xl font-black">
          Önce bir müşteri seç veya yeni kayıt oluştur.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Seçilen müşterinin genel bilgileri, yetkilileri, mekânları ve cari
          hesap hareketleri bu alanda açılır. Böylece liste uzamaz; ekran her
          zaman tek müşteri üzerinde çalışır.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={onOpenSelector}
            className="rounded-full bg-teal-300 px-5 py-3 text-sm font-black text-slate-950"
          >
            Müşteri Ara / Seç
          </button>
          <button
            onClick={onOpenCreatePanel}
            className="rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white"
          >
            Yeni Müşteri Oluştur
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            1. Seç
          </p>
          <h3 className="mt-2 font-black text-slate-950">Müşteri arama</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Üstteki seçiciye ad, telefon veya vergi no yazıp müşteriyi bul.
          </p>
        </article>

        <article className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            2. Yönet
          </p>
          <h3 className="mt-2 font-black text-slate-950">Detay ekranı</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Yetkililer, mekânlar ve hesap hareketleri seçilen müşteri altında
            yönetilir.
          </p>
        </article>

        <article className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            3. Takip
          </p>
          <h3 className="mt-2 font-black text-slate-950">Cari bakiye</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Borç, tahsilat ve kümülatif bakiye müşteri bazında izlenir.
          </p>
        </article>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">
              Hızlı seçim
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Son yüklenen müşteri kayıtlarından seçim yap.
            </p>
          </div>

          <button
            onClick={onOpenSelector}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700"
          >
            Tümünü Ara
          </button>
        </div>

        {suggestedCustomers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="text-sm font-black text-slate-700">
              Henüz müşteri yok.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              İlk müşteriyi oluşturduğunda burada hızlı seçim olarak görünecek.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestedCustomers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer(customer.id)}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50"
              >
                <p className="truncate font-black text-slate-950">
                  {customer.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {getOptionLabel(customerTypeOptions, customer.customer_type)}
                  {customer.city ? ` • ${customer.city}` : ""}
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  {customer.phone ?? "Telefon yok"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
