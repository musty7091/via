import { useState } from "react";

import { ExpenseEntryForm } from "./ExpenseEntryForm";
import type { ExpenseTabKey } from "../types/expenseTypes";

type ExpenseQuickEntryModalProps = {
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const tabs: Array<{ key: ExpenseTabKey; label: string; description: string }> = [
  {
    key: "event",
    label: "Etkinliğe Bağlı Gider",
    description: "Belirli bir etkinliğe yazılan gider.",
  },
  {
    key: "general",
    label: "Genel Aylık Gider",
    description: "Sadece seçili ayın sonucunu etkiler.",
  },
  {
    key: "distributed",
    label: "Dağıtılmış Gider",
    description: "Sezonluk veya yıllık gideri aylara böler.",
  },
];

export function ExpenseQuickEntryModal({ onClose, onSaved }: ExpenseQuickEntryModalProps) {
  const [activeTab, setActiveTab] = useState<ExpenseTabKey>("general");

  async function handleSaved() {
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              Gider İşlemi
            </p>
            <h3 className="mt-2 text-2xl font-black">Hızlı Gider Kaydı</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Bu form Gider Yönetimi modülüyle aynı kayıt mantığını kullanır.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-600"
          >
            Kapat
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-[1.25rem] border p-4 text-left transition ${
                activeTab === tab.key
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-950 hover:border-teal-300"
              }`}
            >
              <p className="font-black">{tab.label}</p>
              <p className="mt-2 text-xs leading-5 opacity-70">{tab.description}</p>
            </button>
          ))}
        </div>

        <ExpenseEntryForm
          activeTab={activeTab}
          onSaved={handleSaved}
          onCancel={onClose}
          showCancelButton
          submitLabel="Devam Et"
          className="mt-6"
        />
      </div>
    </div>
  );
}
