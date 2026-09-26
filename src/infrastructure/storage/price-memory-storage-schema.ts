import * as z from "zod/mini";

import {
  canonicalIdentifierSchema,
  canonicalIsoTimestampSchema,
  canonicalLabelSchema,
  positiveMvpMoneySchema,
} from "./shopping-storage-schema";

export const PRICE_MEMORY_STORAGE_KEY = "budget-cart:price-memory";
export const CURRENT_PRICE_MEMORY_SCHEMA_VERSION = 1;

const manualObservationSourceSchema = z.strictObject({
  kind: z.literal("manual"),
});

const shelfScanObservationSourceSchema = z.strictObject({
  kind: z.literal("shelf-scan"),
  captureId: z.optional(canonicalIdentifierSchema),
});

const retailerFeedObservationSourceSchema = z.strictObject({
  kind: z.literal("retailer-feed"),
  provider: canonicalIdentifierSchema,
});

const priceMemoryObservationSourceV1Schema =
  z.discriminatedUnion("kind", [
    manualObservationSourceSchema,
    shelfScanObservationSourceSchema,
    retailerFeedObservationSourceSchema,
  ]);

export const priceMemoryRecordV1Schema = z.strictObject({
  id: canonicalIdentifierSchema,
  productId: canonicalIdentifierSchema,
  label: canonicalLabelSchema,
  currency: z.literal("EUR"),
  unitPriceMinor: positiveMvpMoneySchema,
  observedAt: canonicalIsoTimestampSchema,
  storeId: z.optional(canonicalIdentifierSchema),
  source: priceMemoryObservationSourceV1Schema,
});

export const priceMemoryDataEnvelopeV1Schema = z.strictObject({
  records: z.array(z.unknown()),
});

export const priceMemoryStorageEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(CURRENT_PRICE_MEMORY_SCHEMA_VERSION),
  savedAt: canonicalIsoTimestampSchema,
  data: z.unknown(),
});

export const priceMemoryStorageEnvelopeHeaderSchema = z.looseObject({
  schemaVersion: z.int().check(z.minimum(1)),
});

export type PriceMemoryRecordV1 = z.infer<typeof priceMemoryRecordV1Schema>;

export interface PriceMemoryEnvelopeV1 {
  readonly schemaVersion: typeof CURRENT_PRICE_MEMORY_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly data: {
    readonly records: readonly PriceMemoryRecordV1[];
  };
}
