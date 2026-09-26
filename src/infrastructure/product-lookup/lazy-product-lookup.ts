import type { ProductLookupPort } from "../../application/barcode-ports";
import type { OpenFoodFactsOptions } from "./open-food-facts";

export const OPEN_FOOD_FACTS_PROVIDER_NAME = "Open Food Facts";

export const createLazyOpenFoodFactsLookup = (
  options: OpenFoodFactsOptions,
): ProductLookupPort => {
  let adapter: Promise<ProductLookupPort> | null = null;

  return {
    providerName: OPEN_FOOD_FACTS_PROVIDER_NAME,
    async lookup(gtin, signal) {
      adapter ??= import("./open-food-facts").then((module) =>
        module.createOpenFoodFactsLookup(options),
      );

      return await (await adapter).lookup(gtin, signal);
    },
  };
};
