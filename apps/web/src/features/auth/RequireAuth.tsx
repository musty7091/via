import { useQueryClient } from "@tanstack/react-query";
import { ShieldX } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { CurrentUserContext, meQueryKey, useCan, useMe, type Permission } from "@/features/auth/auth";
import { ForcePasswordChange } from "@/features/auth/ForcePasswordChange";
import { UNAUTHENTICATED_EVENT } from "@/shared/api/client";
import { Card, EmptyState, LogoMark } from "@/shared/ui";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center text-brand-900">
      <LogoMark className="h-10 animate-pulse" />
    </div>
  );
}

/** Giriş yapılmamışsa giriş ekranına yönlendirir; oturum düşerse otomatik çıkış yapar. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handle = () => queryClient.setQueryData(meQueryKey, null);
    window.addEventListener(UNAUTHENTICATED_EVENT, handle);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, handle);
  }, [queryClient]);

  if (me.isPending) return <Splash />;
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/giris?next=${next}`} replace />;
  }
  if (me.data.must_change_password) return <ForcePasswordChange me={me.data} />;
  return <CurrentUserContext value={me.data}>{children}</CurrentUserContext>;
}

/** Sayfa seviyesinde yetki kontrolü. Asıl güvenlik backend'dedir; bu sadece doğru ekranı gösterir. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const can = useCan();
  if (!can(permission)) {
    return (
      <Card>
        <EmptyState
          icon={ShieldX}
          title="Bu sayfayı görüntüleme yetkiniz yok"
          description="Erişim gerekiyorsa yöneticinizle görüşün."
        />
      </Card>
    );
  }
  return <>{children}</>;
}
