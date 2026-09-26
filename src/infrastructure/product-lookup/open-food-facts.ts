import * as z from "zod/mini";

import type {
  ProductLookupPort,
  ProductLookupResult,
  ProductSuggestion,
} from "../../application/barcode-ports";
import { normalizeProductLabel } from "../../domain/barcode-link";
import { gtinForDisplay, type Gtin } from "../../domain/product-code";
import { OPEN_FOOD_FACTS_PROVIDER_NAME } from "./lazy-product-lookup";

const OPEN_FOOD_FACTS_ORIGIN = "https://world.openfoodfacts.org";
const OPEN_FOOD_FACTS_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "product_name_fi",
  "product_name_sv",
  "brands",
  "quantity",
] as const;

const MAX_RESPONSE_CHARACTERS = 64_000;
const LOOKUP_TIMEOUT_MS = 8_000;

const optionalText = z.optional(z.nullable(z.string()));

const responseSchema = z.looseObject({
  status: z.optional(z.union([z.number(), z.string()])),
  product: z.optional(
    z.looseObject({
      product_name: optionalText,
      product_name_en: optionalText,
      product_name_fi: optionalText,
      product_name_sv: optionalText,
      brands: optionalText,
      quantity: optionalText,
    }),
  ),
});

export interface OpenFoodFactsOptions {
  readonly fetch: typeof fetch;
  readonly appName: string;
  readonly appVersion: string;
  readonly timeoutMs?: number;
  readonly isOnline?: () => boolean;
}

export const openFoodFactsUrl = (
  gtin: Gtin,
  appName: string,
  appVersion: string,
): string => {
  const url = new URL(
    `/api/v2/product/${gtinForDisplay(gtin)}`,
    OPEN_FOOD_FACTS_ORIGIN,
  );
  url.searchParams.set("fields", OPEN_FOOD_FACTS_FIELDS.join(","));
  url.searchParams.set("app_name", appName);
  url.searchParams.set("app_version", appVersion);
  return url.toString();
};

const cleanText = (value: string | null | undefined, maxLength: number) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = value.normalize("NFKC").replace(/\s+/gu, " ").trim();

  return normalized === "" ? undefined : [...normalized].slice(0, maxLength).join("");
};

export const suggestionFromResponse = (
  body: unknown,
): ProductSuggestion | null => {
  const parsed = responseSchema.safeParse(body);

  if (!parsed.success || parsed.data.product === undefined) {
    return null;
  }

  const product = parsed.data.product;
  const name =
    cleanText(product.product_name, 90) ??
    cleanText(product.product_name_en, 90) ??
    cleanText(product.product_name_fi, 90) ??
    cleanText(product.product_name_sv, 90);

  if (name === undefined) {
    return null;
  }

  const quantity = cleanText(product.quantity, 20);
  const brand = cleanText(product.brands?.split(",")[0], 40);
  const label = normalizeProductLabel(
    quantity === undefined || name.toLocaleLowerCase("en").includes(quantity.toLocaleLowerCase("en"))
      ? name
      : `${name} ${quantity}`,
  );

  if (label === null) {
    return null;
  }

  return {
    name: label,
    ...(brand === undefined ? {} : { brand }),
    ...(quantity === undefined ? {} : { quantity }),
  };
};

const withTimeout = (signal: AbortSignal, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Lookup timed out", "TimeoutError"));
  }, timeoutMs);
  const forward = () => {
    controller.abort(signal.reason);
  };

  if (signal.aborted) {
    forward();
  } else {
    signal.addEventListener("abort", forward, { once: true });
  }

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      signal.removeEventListener("abort", forward);
    },
  };
};

export const createOpenFoodFactsLookup = (
  options: OpenFoodFactsOptions,
): ProductLookupPort => ({
  providerName: OPEN_FOOD_FACTS_PROVIDER_NAME,
  async lookup(gtin, signal): Promise<ProductLookupResult> {
    signal.throwIfAborted();

    if (options.isOnline?.() === false) {
      return { status: "failed", reason: "offline" };
    }

    const scoped = withTimeout(signal, options.timeoutMs ?? LOOKUP_TIMEOUT_MS);

    try {
      const response = await options.fetch(
        openFoodFactsUrl(gtin, options.appName, options.appVersion),
        {
          method: "GET",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          headers: { Accept: "application/json" },
          signal: scoped.signal,
        },
      );

      if (response.status === 404) {
        return { status: "not-found" };
      }

      if (!response.ok) {
        return { status: "failed", reason: "unavailable" };
      }

      const text = await response.text();

      if (text.length > MAX_RESPONSE_CHARACTERS) {
        return { status: "failed", reason: "invalid-response" };
      }

      let body: unknown;

      try {
        body = JSON.parse(text);
      } catch {
        return { status: "failed", reason: "invalid-response" };
      }

      const parsed = responseSchema.safeParse(body);

      if (!parsed.success) {
        return { status: "failed", reason: "invalid-response" };
      }

      const status = parsed.data.status;

      if (status === 0 || status === "0" || status === "failure") {
        return { status: "not-found" };
      }

      const product = suggestionFromResponse(body);

      return product === null ? { status: "not-found" } : { status: "found", product };
    } catch (error) {
      if (scoped.signal.aborted && !signal.aborted) {
        return { status: "failed", reason: "timeout" };
      }

      if (signal.aborted) {
        throw error;
      }

      return {
        status: "failed",
        reason: options.isOnline?.() === false ? "offline" : "unavailable",
      };
    } finally {
      scoped.dispose();
    }
  },
});
