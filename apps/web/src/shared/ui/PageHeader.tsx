import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Başlığın üstündeki küçük üst bilgi (ör. "Finans Merkezi") */
  eyebrow?: string;
  /** Detay sayfalarında listeye dönüş bağlantısı */
  back?: { to: string; label: string };
}

export function PageHeader({ title, description, actions, eyebrow, back }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand-700"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-medium tracking-[0.18em] text-accent-600 uppercase">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-normal tracking-tight sm:text-[28px]">{title}</h1>
          {description && <div className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
