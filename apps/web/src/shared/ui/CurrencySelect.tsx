import type { SelectHTMLAttributes } from "react";

import { CURRENCIES } from "@/shared/lib/format";
import { Select } from "@/shared/ui/Field";

interface CurrencySelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Verilirse en üste boş değerli bir seçenek eklenir (ör. "Varsayılan"). */
  emptyLabel?: string;
}

/** Para birimi seçimi: TL, Euro, Sterlin, Dolar. */
export function CurrencySelect({ emptyLabel, ...props }: CurrencySelectProps) {
  return (
    <Select {...props}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {CURRENCIES.map((currency) => (
        <option key={currency.value} value={currency.value}>
          {currency.label}
        </option>
      ))}
    </Select>
  );
}
