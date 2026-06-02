import { invoiceTypeOptions, offerStatusOptions } from "./constants/offerConstants";

function assertTrue(value: boolean, label: string) {
  if (!value) {
    throw new Error(`Offers frontend smoke check failed: ${label}`);
  }
}

assertTrue(invoiceTypeOptions.some((item) => item.value === "with_invoice"), "with invoice option");
assertTrue(offerStatusOptions.some((item) => item.value === "agreement"), "agreement status option");

console.log("Offers frontend smoke check passed.");
