import { z } from "zod";

import {
  MAX_MVP_MONEY_MINOR,
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
} from "../../domain/money";
import { MAX_ITEM_LABEL_CODE_POINTS } from "../../domain/shopping-trip";

export const ACTIVE_TRIP_STORAGE_KEY = "budget-cart:active-trip";
export const LEGACY_PULSE_STORAGE_KEYS = [
  "pulse-counter:state",
  "counter",
] as const;
export const CURRENT_ACTIVE_TRIP_SCHEMA_VERSION = 1;

const CANONICAL_ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const canonicalIsoTimestampSchema = z
  .string()
  .regex(CANONICAL_ISO_TIMESTAMP);

const canonicalIdentifierSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value);

const optionalCanonicalIdentifierSchema = canonicalIdentifierSchema.optional();

const canonicalLabelSchema = z
  .string()
  .refine((value) => value.trim() === value)
  .refine((value) => [...value].length <= MAX_ITEM_LABEL_CODE_POINTS);

const positiveMvpMoneySchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_MVP_MONEY_MINOR);

const nonNegativeMvpMoneySchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_MVP_MONEY_MINOR);

const quantitySchema = z
  .number()
  .int()
  .min(MIN_MVP_QUANTITY)
  .max(MAX_MVP_QUANTITY);

const manualPriceSourceSchema = z
  .object({
    kind: z.literal("manual"),
  })
  .strict();

const priceMemorySourceSchema = z
  .object({
    kind: z.literal("price-memory"),
    memoryId: canonicalIdentifierSchema,
  })
  .strict();

const shelfScanSourceSchema = z
  .object({
    kind: z.literal("shelf-scan"),
    captureId: optionalCanonicalIdentifierSchema,
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

export const priceSourceV1Schema = z.discriminatedUnion("kind", [
  manualPriceSourceSchema,
  priceMemorySourceSchema,
  shelfScanSourceSchema,
  encodedBarcodeSourceSchema,
  retailerFeedSourceSchema,
]);

const confirmedPriceConfidenceSchema = z
  .object({
    kind: z.literal("confirmed"),
    confirmedAt: canonicalIsoTimestampSchema,
  })
  .strict();

const rememberedPriceConfidenceSchema = z
  .object({
    kind: z.literal("remembered"),
    observedAt: canonicalIsoTimestampSchema,
    storeId: optionalCanonicalIdentifierSchema,
  })
  .strict();

const estimatedPriceConfidenceSchema = z
  .object({
    kind: z.literal("estimated"),
    reason: z.enum(["weighted", "unknown", "other"]).optional(),
  })
  .strict();

export const priceConfidenceV1Schema = z.discriminatedUnion("kind", [
  confirmedPriceConfidenceSchema,
  rememberedPriceConfidenceSchema,
  estimatedPriceConfidenceSchema,
]);

export const cartItemV1Schema = z
  .object({
    id: canonicalIdentifierSchema,
    unitPriceMinor: positiveMvpMoneySchema,
    quantity: quantitySchema,
    label: canonicalLabelSchema.optional(),
    priceSource: priceSourceV1Schema,
    priceConfidence: priceConfidenceV1Schema,
    createdAt: canonicalIsoTimestampSchema,
    updatedAt: canonicalIsoTimestampSchema,
  })
  .strict();

export const activeTripDataV1Schema = z
  .object({
    id: canonicalIdentifierSchema,
    status: z.literal("active"),
    currency: z.literal("EUR"),
    budgetMinor: positiveMvpMoneySchema,
    safetyBufferMinor: nonNegativeMvpMoneySchema,
    startedAt: canonicalIsoTimestampSchema,
    items: z.array(cartItemV1Schema),
  })
  .strict();

export const storageEnvelopeHeaderSchema = z
  .object({
    schemaVersion: z.number().int().min(1),
  })
  .passthrough();

export const storageEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(CURRENT_ACTIVE_TRIP_SCHEMA_VERSION),
    savedAt: canonicalIsoTimestampSchema,
    data: z.unknown(),
  })
  .strict();

export type PriceSourceV1 = z.infer<typeof priceSourceV1Schema>;
export type PriceConfidenceV1 = z.infer<typeof priceConfidenceV1Schema>;
export type CartItemV1 = z.infer<typeof cartItemV1Schema>;
export type ActiveTripDataV1 = z.infer<typeof activeTripDataV1Schema>;

export interface ActiveTripEnvelopeV1 {
  readonly schemaVersion: typeof CURRENT_ACTIVE_TRIP_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly data: ActiveTripDataV1;
}
