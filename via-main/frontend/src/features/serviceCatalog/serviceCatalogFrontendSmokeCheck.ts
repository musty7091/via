import { artistTypeOptions, packageTypeOptions } from "./constants/serviceCatalogConstants";

function assertTrue(value: boolean, label: string) {
  if (!value) {
    throw new Error(`Service Catalog frontend smoke check failed: ${label}`);
  }
}

assertTrue(artistTypeOptions.some((item) => item.value === "solo_artist"), "solo artist option");
assertTrue(packageTypeOptions.some((item) => item.value === "program"), "program package option");

console.log("Service Catalog frontend smoke check passed.");
