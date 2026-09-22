import { z } from "zod";

import {
  MAX_MVP_MONEY_MINOR,
} from "../../domain/money";
import { MAX_ITEM_LABEL_CODE_POINTS } from "../../domain/shopping-trip";

export const PRICE_MEMORY_STORAGE_KEY = "budget-cart:price-memory";
export const CURRENT_PRICE_MEMORY_SCHEMA_VERSION = 1;

const CANONICAL_ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const canonicalIsoTimestampSchema = z
  .string()
  .regex(CANONICAL_ISO_TIMESTAMP);

const canonicalIdentifierSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);

const canonicalLabelSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value)
  .refine((value) => [...value].length <= MAX_ITEM_LABEL_CODE_POINTS);

const positiveMvpMoneySchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_MVP_MONEY_MINOR);

const manualObservationSourceSchema = z
  .object({
    kind: z.literal("manual"),
  })
  .strict();

const shelfScanObservationSourceSchema = z
  .object({
    kind: z.literal("shelf-scan"),
    captureId: canonicalIdentifierSchema.optional(),
  })
  .strict();

const retailerFeedObservationSourceSchema = z
  .object({
    kind: z.literal("retailer-feed"),
    provider: canonicalIdentifierSchema,
  })
  .strict();

export const priceMemoryObservationSourceV1Schema =
  z.discriminatedUnion("kind", [
    manualObservationSourceSchema,
    shelfScanObservationSourceSchema,
    retailerFeedObservationSourceSchema,
  ]);

export const priceMemoryRecordV1Schema = z
  .object({
    id: canonicalIdentifierSchema,
    productId: canonicalIdentifierSchema,
    label: canonicalLabelSchema,
    currency: z.literal("EUR"),
    unitPriceMinor: positiveMvpMoneySchema,
    observedAt: canonicalIsoTimestampSchema,
    storeId: canonicalIdentifierSchema.optional(),
    source: priceMemoryObservationSourceV1Schema,
  })
  .strict();

export const priceMemoryDataEnvelopeV1Schema = z
  .object({
    records: z.array(z.unknown()),
  })
  .strict();

export const priceMemoryStorageEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(CURRENT_PRICE_MEMORY_SCHEMA_VERSION),
    savedAt: canonicalIsoTimestampSchema,
    data: z.unknown(),
  })
  .strict();

export const priceMemoryStorageEnvelopeHeaderSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
  })
  .passthrough();

export type PriceMemoryObservationSourceV1 = z.infer<
  typeof priceMemoryObservationSourceV1Schema
>;
export type PriceMemoryRecordV1 = z.infer<typeof priceMemoryRecordV1Schema>;

export interface PriceMemoryEnvelopeV1 {
  readonly schemaVersion: typeof CURRENT_PRICE_MEMORY_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly data: {
    readonly records: readonly PriceMemoryRecordV1[];
  };
}
