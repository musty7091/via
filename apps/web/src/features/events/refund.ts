import { todayISO } from "@/shared/lib/format";

export interface RefundState {
  enabled: boolean;
  amount: string;
  accountId: string;
  date: string;
  rate: string;
}

export const emptyRefund = (): RefundState => ({ enabled: false, amount: "", accountId: "", date: todayISO(), rate: "" });

/** "10.000,50" → "10000.50" (API ondalık noktası bekler). */
export const decimalText = (value: string) => value.replace(/\./g, "").replace(",", ".");
