import { Hammer } from "lucide-react";
import { useLocation } from "react-router";

import { NAVIGATION } from "@/app/navigation";
import { Card, EmptyState, PageHeader } from "@/shared/ui";

export function ComingSoonPage() {
  const { pathname } = useLocation();
  const item = NAVIGATION.flatMap((section) => section.items).find((nav) => nav.to === pathname);
  return (
    <>
      <PageHeader title={item?.label ?? "Sayfa"} />
      <Card>
        <EmptyState
          icon={Hammer}
          title="Bu ekran yapım aşamasında"
          description="Yol haritasındaki ilgili aşamada eklenecek."
        />
      </Card>
    </>
  );
}
