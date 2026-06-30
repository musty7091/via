import { eventStatusOptions } from "./constants/eventConstants";

function assertTrue(value: boolean, label: string) {
  if (!value) {
    throw new Error(`Events frontend smoke check failed: ${label}`);
  }
}

assertTrue(eventStatusOptions.some((item) => item.value === "planned"), "planned status option");

console.log("Events frontend smoke check passed.");
