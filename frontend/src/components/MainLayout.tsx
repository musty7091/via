import React, { ReactNode } from 'react';

interface MainLayoutProps {
  children: ReactNode;
  userName?: string;
  onLogout?: () => void;
  /** YENİ (opsiyonel): Sayfa başlığı. Verilirse logonun yanında görünür. Örn: "Etkinlikler" */
  title?: string;
  /** YENİ (opsiyonel): Verilirse header'a "Geri Dön" butonu eklenir ve tıklanınca bu çalışır. */
  onBack?: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  userName = "Yönetici",
  onLogout,
  title,
  onBack
}) => {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">

      {/* 1. BÖLÜM: HEADER (TAVAN) */}
      <header className="flex-none bg-white shadow-sm border-b border-slate-200 px-4 sm:px-6 py-4 flex justify-between items-center">

        {/* Sol Taraf - Logo (+ opsiyonel sayfa başlığı) */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <img
            src="/brand/via-logo-horizontal.png"
            alt="VIA EVENTS Logo"
            className="h-8 sm:h-10 object-contain flex-none" /* Mobilde logoyu bir tık küçültüyoruz, büyük ekranda normal kalıyor */
          />

          {/* Başlık SADECE title verildiğinde görünür. Dashboard title vermediği için hiçbir şey değişmez. */}
          {title ? (
            <>
              <span className="hidden sm:block h-6 w-px bg-slate-200" aria-hidden="true" />
              <h1 className="truncate text-base sm:text-xl font-bold text-slate-900">
                {title}
              </h1>
            </>
          ) : null}
        </div>

        {/* Sağ Taraf - (opsiyonel Geri Dön) + Oturum Bilgisi + Çıkış Butonu */}
        {/* Mobilde space-x-3 (dar boşluk), büyük ekranda space-x-6 (geniş boşluk) */}
        <div className="flex items-center space-x-3 sm:space-x-6">

          {/* GERI DÖN BUTONU: SADECE onBack verildiğinde görünür. */}
          {onBack ? (
            <button
              onClick={onBack}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-slate-200 text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap"
            >
              Geri Dön
            </button>
          ) : null}

          {/* SADECE BÜYÜK EKRANLARDA GÖRÜNÜR (hidden sm:block) */}
          <div className="hidden sm:block text-sm text-slate-600">
            Oturum açık: <span className="font-medium text-slate-900">{userName}</span>
          </div>

          {/* ÇIKIŞ BUTONU: Mobilde biraz daha küçük (px-3 py-1.5 text-xs) */}
          <button
            onClick={onLogout}
            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-red-200 text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap"
          >
            Çıkış Yap
          </button>
        </div>
      </header>

      {/* 2. BÖLÜM: İÇERİK ALANI (GÖVDE) */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>

      {/* 3. BÖLÜM: FOOTER (TABAN) */}
      <footer className="flex-none bg-slate-800 text-slate-300 py-4 text-center text-xs sm:text-sm">
        <p>© 2026 VIA EVENTS. Tüm hakları saklıdır.</p>
      </footer>

    </div>
  );
};

export default MainLayout;