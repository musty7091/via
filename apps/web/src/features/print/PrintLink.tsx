import { Printer } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/shared/ui";

/** Çıktı sayfasını yeni sekmede açar. */
export function PrintLink({ to, label = "Yazdır" }: { to: string; label?: string }) {
  return (
    <Button variant="secondary" size="sm" asChild>
      <Link to={to} target="_blank" rel="noopener">
        <Printer /> {label}
      </Link>
    </Button>
  );
}
