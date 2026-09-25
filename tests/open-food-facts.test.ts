import { describe, expect, it, vi } from "vitest";

import type { Gtin } from "../src/domain/product-code";
import { createLazyOpenFoodFactsLookup } from "../src/infrastructure/product-lookup/lazy-product-lookup";
import {
  createOpenFoodFactsLookup,
  openFoodFactsUrl,
  suggestionFromResponse,
} from "../src/infrastructure/product-lookup/open-food-facts";

const MILK = "06414893386303" as Gtin;
const EAN8 = "00000096385074" as Gtin;

const respond = (status: number, body: unknown) =>
  vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

const lookupWith = (fetchImpl: typeof fetch, online = true) =>
  createOpenFoodFactsLookup({
    fetch: fetchImpl,
    appName: "ShoppingBudgetCompanion",
    appVersion: "2.0.0",
    timeoutMs: 50,
    isOnline: () => online,
  });

describe("Open Food Facts product lookup", () => {
  it("asks only for the fields it shows, identifies the app and sends no credentials", async () => {
    const fetchImpl = respond(200, { status: 1, product: { product_name: "Maito", quantity: "1 l" } });
    const result = await lookupWith(fetchImpl as unknown as typeof fetch).lookup(
      MILK,
      new AbortController().signal,
    );

    expect(result).toEqual({
      status: "found",
      product: { name: "Maito 1 l", quantity: "1 l" },
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://world.openfoodfacts.org");
    expect(parsed.pathname).toBe("/api/v2/product/6414893386303");
    expect(parsed.searchParams.get("fields")).toBe(
      "code,product_name,product_name_en,product_name_fi,product_name_sv,brands,quantity",
    );
    expect(parsed.searchParams.get("app_name")).toBe("ShoppingBudgetCompanion");
    expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer", method: "GET" });
    expect(openFoodFactsUrl(EAN8, "a", "1")).toContain("/api/v2/product/96385074?");
  });

  it("treats an unknown barcode as normal", async () => {
    await expect(
      lookupWith(respond(404, { status: 0, status_verbose: "product not found" }) as unknown as typeof fetch).lookup(
        MILK,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ status: "not-found" });
    await expect(
      lookupWith(respond(200, { status: 0 }) as unknown as typeof fetch).lookup(MILK, new AbortController().signal),
    ).resolves.toEqual({ status: "not-found" });
    await expect(
      lookupWith(respond(200, { status: 1, product: { product_name: "   " } }) as unknown as typeof fetch).lookup(
        MILK,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ status: "not-found" });
  });

  it("reports provider and response failures without guessing", async () => {
    const signal = new AbortController().signal;

    await expect(lookupWith(respond(429, "slow down") as unknown as typeof fetch).lookup(MILK, signal)).resolves.toEqual({
      status: "failed",
      reason: "unavailable",
    });
    await expect(lookupWith(respond(200, "<html>") as unknown as typeof fetch).lookup(MILK, signal)).resolves.toEqual({
      status: "failed",
      reason: "invalid-response",
    });
    await expect(
      lookupWith(respond(200, { status: 1, product: "nope" }) as unknown as typeof fetch).lookup(MILK, signal),
    ).resolves.toEqual({ status: "failed", reason: "invalid-response" });
    await expect(
      lookupWith(respond(200, JSON.stringify({ status: 1, padding: "x".repeat(70_000) })) as unknown as typeof fetch).lookup(
        MILK,
        signal,
      ),
    ).resolves.toEqual({ status: "failed", reason: "invalid-response" });
    await expect(
      lookupWith(vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch).lookup(MILK, signal),
    ).resolves.toEqual({ status: "failed", reason: "unavailable" });
  });

  it("does not reach the network while offline", async () => {
    const fetchImpl = vi.fn();

    await expect(
      lookupWith(fetchImpl as unknown as typeof fetch, false).lookup(MILK, new AbortController().signal),
    ).resolves.toEqual({ status: "failed", reason: "offline" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("times out a slow provider and stops when the caller cancels", async () => {
    const hanging = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );

    await expect(
      lookupWith(hanging as unknown as typeof fetch).lookup(MILK, new AbortController().signal),
    ).resolves.toEqual({ status: "failed", reason: "timeout" });

    const cancel = new AbortController();
    const pending = lookupWith(hanging as unknown as typeof fetch).lookup(MILK, cancel.signal);
    cancel.abort();

    await expect(pending).rejects.toThrow();

    const already = new AbortController();
    already.abort();
    await expect(lookupWith(hanging as unknown as typeof fetch).lookup(MILK, already.signal)).rejects.toThrow();
  });

  it("turns a provider record into a short, safe product name", () => {
    expect(
      suggestionFromResponse({
        status: 1,
        product: {
          product_name: null,
          product_name_en: "  Oat   drink ",
          brands: "Oatly, Other",
          quantity: "1 l",
        },
      }),
    ).toEqual({ name: "Oat drink 1 l", brand: "Oatly", quantity: "1 l" });
    expect(
      suggestionFromResponse({ product: { product_name: "Milk 1 l", quantity: "1 L" } }),
    ).toEqual({ name: "Milk 1 l", quantity: "1 L" });
    expect(
      suggestionFromResponse({ product: { product_name: "A".repeat(200) } })?.name,
    ).toHaveLength(90);
    expect(suggestionFromResponse({ status: 1 })).toBeNull();
    expect(suggestionFromResponse("nope")).toBeNull();
  });

  it("loads the provider adapter only when a lookup is requested", async () => {
    const fetchImpl = respond(200, { status: 1, product: { product_name: "Maito" } });
    const lookup = createLazyOpenFoodFactsLookup({
      fetch: fetchImpl as unknown as typeof fetch,
      appName: "ShoppingBudgetCompanion",
      appVersion: "2.0.0",
    });

    expect(lookup.providerName).toBe("Open Food Facts");
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(lookup.lookup(MILK, new AbortController().signal)).resolves.toMatchObject({
      status: "found",
      product: { name: "Maito" },
    });
    await lookup.lookup(MILK, new AbortController().signal);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
