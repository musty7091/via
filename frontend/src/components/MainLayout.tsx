import type { ReactNode } from "react";

import { AppLayout } from "./AppLayout";

/**
 * MainLayout — geriye dönük uyumluluk için korunan ince sarmalayıcı.
 *
 * Eskiden burada ayrı bir header/footer vardı. Artık tüm ekran tabanı
 * tek bir yerden (AppLayout) geliyor. Bu dosya sadece eski prop adlarını
 * (userName, title, onBack) AppLayout'a aktarır; böylece bu layout'u kullanan
 * sayfalarda hiçbir değişiklik yapmadan ortak tabana geçmiş oluyoruz.
 */
interface MainLayoutProps {
  children: ReactNode;
  userName?: string;
  onLogout?: () => void;
  /** Logonun yanında görünen küçük sayfa başlığı. */
  title?: string;
  /** Verilirse içeriğin üstünde "Geri Dön" butonu çıkar. */
  onBack?: () => void;
}

export function MainLayout({
  children,
  userName,
  onLogout,
  title,
  onBack,
}: MainLayoutProps) {
  return (
    <AppLayout
      userName={userName}
      onLogout={onLogout}
      headerTitle={title}
      onBack={onBack}
    >
      {children}
    </AppLayout>
  );
}

export default MainLayout;
