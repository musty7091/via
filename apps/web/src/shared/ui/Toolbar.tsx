import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Field";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  /** Yazma bittikten 300 ms sonra çağrılır. */
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange, className, ...props }: SearchInputProps) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const timer = useRef<number | undefined>(undefined);

  // Dışarıdan değer değişirse (ör. filtre sıfırlama) kutuyu güncelle.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
      <Input
        type="search"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onChange(next), 300);
        }}
        className="pl-9"
        {...props}
      />
    </div>
  );
}

/** Liste üstündeki filtre satırı. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      {children}
    </div>
  );
}

interface PagerProps {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}

export function Pager({ offset, limit, total, onChange }: PagerProps) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-muted sm:px-5">
      <span className="tabular">
        {from}–{to} / {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={to >= total}
          onClick={() => onChange(offset + limit)}
          aria-label="Sonraki sayfa"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
