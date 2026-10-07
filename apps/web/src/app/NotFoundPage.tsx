import { SearchX } from "lucide-react";
import { Link } from "react-router";

import { Button, Card, EmptyState, PageHeader } from "@/shared/ui";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Sayfa bulunamadı" />
      <Card>
        <EmptyState
          icon={SearchX}
          title="Aradığınız sayfa yok"
          description="Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir."
          action={
            <Button asChild variant="secondary">
              <Link to="/">Genel Bakış'a dön</Link>
            </Button>
          }
        />
      </Card>
    </>
  );
}
