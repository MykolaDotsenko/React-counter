import { z } from "zod";

import { MAX_MVP_MONEY_MINOR } from "../../domain/money";
import {
  MAX_ITEM_LABEL_CODE_POINTS,
  MAX_STORE_LABEL_CODE_POINTS,
} from "../../domain/shopping-trip";

export const PRICE_MEMORY_STORAGE_KEY = "budget-cart:price-memory";
export const CURRENT_PRICE_MEMORY_SCHEMA_VERSION = 1;

const CANONICAL_ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const canonicalTimestampSchema = z
  .string()
  .regex(CANONICAL_ISO_TIMESTAMP);

const canonicalIdentifierSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);

const productLabelSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value)
  .refine((value) => [...value].length <= MAX_ITEM_LABEL_CODE_POINTS);

const storeSchema = z
  .object({
    id: canonicalIdentifierSchema,
    label: z
      .string()
      .min(1)
      .refine((value) => value.trim() === value)
      .refine(
        (value) => [...value].length <= MAX_STORE_LABEL_CODE_POINTS,
      ),
  })
  .strict();

const manualSourceSchema = z
  .object({ kind: z.literal("manual") })
  .strict();

const shelfScanSourceSchema = z
  .object({
    kind: z.literal("shelf-scan"),
    captureId: canonicalIdentifierSchema.optional(),
  })
  .strict();

const encodedBarcodeSourceSchema = z
  .object({
    kind: z.literal("encoded-barcode"),
    symbology: canonicalIdentifierSchema,
  })
  .strict();

const retailerFeedSourceSchema = z
  .object({
    kind: z.literal("retailer-feed"),
    provider: canonicalIdentifierSchema,
  })
  .strict();

export const observedPriceSourceV1Schema = z.discriminatedUnion(
  "kind",
  [
    manualSourceSchema,
    shelfScanSourceSchema,
    encodedBarcodeSourceSchema,
    retailerFeedSourceSchema,
  ],
);

export const priceMemoryRecordV1Schema = z
  .object({
    id: canonicalIdentifierSchema,
    product: z
      .object({
        id: canonicalIdentifierSchema,
        label: productLabelSchema,
      })
      .strict(),
    unitPriceMinor: z
      .number()
      .int()
      .min(1)
      .max(MAX_MVP_MONEY_MINOR),
    observedAt: canonicalTimestampSchema,
    store: storeSchema.optional(),
    source: observedPriceSourceV1Schema,
  })
  .strict();

export const priceMemoryDataV1Schema = z
  .object({
    records: z.array(z.unknown()),
  })
  .strict();

export const priceMemoryEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(CURRENT_PRICE_MEMORY_SCHEMA_VERSION),
    savedAt: canonicalTimestampSchema,
    data: z.unknown(),
  })
  .strict();

export type PriceMemoryRecordV1 = z.infer<
  typeof priceMemoryRecordV1Schema
>;

export interface PriceMemoryEnvelopeV1 {
  readonly schemaVersion: typeof CURRENT_PRICE_MEMORY_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly data: {
    readonly records: readonly PriceMemoryRecordV1[];
  };
}
