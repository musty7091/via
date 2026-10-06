import { cn } from "@/shared/lib/cn";

/** VIA işareti, logodan vektörel olarak çizildi; rengi metin renginden alır. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 360" fill="none" className={cn("h-6 w-auto", className)} aria-hidden>
      <path
        d="M48 66V318L262 80M165 282L378 80M268 282L510 40V316"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-display text-[15px] font-light tracking-[0.42em] whitespace-nowrap">
          VIA EVENTS
        </span>
      )}
    </span>
  );
}
