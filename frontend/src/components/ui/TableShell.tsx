import type { ReactNode } from "react";

type TableShellProps = {
  children: ReactNode;
  className?: string;
};

export function TableShell({ children, className = "" }: TableShellProps) {
  return (
    <div className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white ${className}`}>
      {children}
    </div>
  );
}
