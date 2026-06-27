import type { ReactNode } from "react";

import { AppLayout } from "../AppLayout";

/**
 * ViaPageShell — geriye dönük uyumluluk için korunan ince sarmalayıcı.
 *
 * Zengin başlık kartı (eyebrow + title + description + actions) ve "Geri Dön"
 * davranışı artık ortak tabandan (AppLayout) geliyor. Bu dosya sadece eski
 * prop adlarını AppLayout'a aktarır; ViaPageShell kullanan sayfalar
 * (Teklifler, Anlaşmalar) hiç değişmeden ortak tabana bağlanır.
 */
type ViaPageShellProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function ViaPageShell({
  eyebrow,
  title,
  description,
  subtitle,
  onBack,
  backLabel = "Geri Dön",
  actions,
  children,
}: ViaPageShellProps) {
  return (
    <AppLayout
      eyebrow={eyebrow}
      title={title}
      description={description ?? subtitle}
      onBack={onBack}
      backLabel={backLabel}
      actions={actions}
    >
      {children}
    </AppLayout>
  );
}

export default ViaPageShell;
