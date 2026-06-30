import {
  customerStatusOptions,
  customerTypeOptions,
  ledgerMovementTypeOptions,
} from "./constants/customerConstants";

function assertTrue(value: boolean, label: string) {
  if (!value) {
    throw new Error(`Frontend smoke check failed: ${label}`);
  }
}

assertTrue(customerTypeOptions.length >= 8, "customer type options");
assertTrue(customerStatusOptions.some((item) => item.value === "active"), "active status");
assertTrue(
  ledgerMovementTypeOptions.some((item) => item.value === "event_charge"),
  "event charge movement type"
);

console.log("Customer frontend smoke check passed.");
