import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: "left" | "right";
  /** Mobil kart görünümünde gizlensin mi? */
  hideOnMobile?: boolean;
  /** Hücre kendi butonlarını içeriyorsa (ör. işlem menüsü) true; mobilde kartın sağ üstüne yerleşir. */
  interactive?: boolean;
  className?: string;
}

interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  onRowClick?: (row: Row) => void;
  empty?: ReactNode;
}

/**
 * Tüm listeler bu tabloyla gösterilir.
 * Masaüstünde tablo, mobilde (md altı) her satır bir kart olur; yatay kaydırma gerekmez.
 */
export function DataTable<Row>({ columns, rows, rowKey, onRowClick, empty }: DataTableProps<Row>) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const [primary, ...rest] = columns;
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-5 py-2.5 text-xs font-medium text-ink-muted",
                    column.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line last:border-0",
                  onRowClick && "cursor-pointer hover:bg-surface-muted",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-5 py-3 align-middle",
                      column.align === "right" && "text-right tabular",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {rows.map((row) => {
          const fields = rest.filter((column) => !column.hideOnMobile && !column.interactive);
          const actions = rest.filter((column) => column.interactive);
          const body = (
            <>
              <div className={cn("font-medium text-ink", actions.length > 0 && "pr-10")}>
                {primary.cell(row)}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {fields.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-xs text-ink-muted">{column.header}</dt>
                    <dd className="truncate">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)} className="relative">
              {onRowClick ? (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="block w-full px-4 py-3 text-left active:bg-surface-muted"
                >
                  {body}
                </button>
              ) : (
                <div className="px-4 py-3">{body}</div>
              )}
              {actions.length > 0 && (
                // Butonun içine değil yanına yerleşir: iç içe buton HTML'de geçersizdir.
                <div className="absolute top-2 right-2 flex gap-1">
                  {actions.map((column) => (
                    <span key={column.key}>{column.cell(row)}</span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
