import * as z from "zod/mini";

import {
  MAX_MVP_MONEY_MINOR,
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
} from "../../domain/money";
import {
  CANONICAL_ISO_TIMESTAMP_PATTERN,
  MAX_ITEM_LABEL_CODE_POINTS,
} from "../../domain/shopping-trip";

export const ACTIVE_TRIP_STORAGE_KEY = "budget-cart:active-trip";
export const HISTORY_STORAGE_KEY = "budget-cart:history";
export const HISTORICAL_NON_SHOPPING_STORAGE_KEYS = [
  "pulse-counter:state",
  "counter",
] as const;
export const CURRENT_ACTIVE_TRIP_SCHEMA_VERSION = 1;
export const CURRENT_HISTORY_SCHEMA_VERSION = 1;

export const canonicalIsoTimestampSchema = z
  .string()
  .check(z.regex(CANONICAL_ISO_TIMESTAMP_PATTERN));

export const canonicalIdentifierSchema = z
  .string()
  .check(
    z.minLength(1),
    z.refine((value) => value.trim() === value),
  );

const optionalCanonicalIdentifierSchema = z.optional(
  canonicalIdentifierSchema,
);

export const canonicalLabelSchema = z
  .string()
  .check(
    z.minLength(1),
    z.refine((value) => value.trim() === value),
    z.refine((value) => [...value].length <= MAX_ITEM_LABEL_CODE_POINTS),
  );

export const positiveMvpMoneySchema = z
  .int()
  .check(z.minimum(1), z.maximum(MAX_MVP_MONEY_MINOR));

const nonNegativeMvpMoneySchema = z
  .int()
  .check(z.minimum(0), z.maximum(MAX_MVP_MONEY_MINOR));

const quantitySchema = z
  .int()
  .check(z.minimum(MIN_MVP_QUANTITY), z.maximum(MAX_MVP_QUANTITY));

const manualPriceSourceSchema = z.strictObject({
  kind: z.literal("manual"),
});

const priceMemorySourceSchema = z.strictObject({
  kind: z.literal("price-memory"),
  memoryId: canonicalIdentifierSchema,
});

const shelfScanSourceSchema = z.strictObject({
  kind: z.literal("shelf-scan"),
  captureId: optionalCanonicalIdentifierSchema,
});

const encodedBarcodeSourceSchema = z.strictObject({
  kind: z.literal("encoded-barcode"),
  symbology: canonicalIdentifierSchema,
});

const retailerFeedSourceSchema = z.strictObject({
  kind: z.literal("retailer-feed"),
  provider: canonicalIdentifierSchema,
});

export const priceSourceV1Schema = z.discriminatedUnion("kind", [
  manualPriceSourceSchema,
  priceMemorySourceSchema,
  shelfScanSourceSchema,
  encodedBarcodeSourceSchema,
  retailerFeedSourceSchema,
]);

const confirmedPriceConfidenceSchema = z.strictObject({
  kind: z.literal("confirmed"),
  confirmedAt: canonicalIsoTimestampSchema,
});

const rememberedPriceConfidenceSchema = z.strictObject({
  kind: z.literal("remembered"),
  observedAt: canonicalIsoTimestampSchema,
  storeId: optionalCanonicalIdentifierSchema,
});

const estimatedPriceConfidenceSchema = z.strictObject({
  kind: z.literal("estimated"),
  reason: z.optional(z.enum(["weighted", "unknown", "other"])),
});

export const priceConfidenceV1Schema = z.discriminatedUnion("kind", [
  confirmedPriceConfidenceSchema,
  rememberedPriceConfidenceSchema,
  estimatedPriceConfidenceSchema,
]);

export const cartItemV1Schema = z.strictObject({
  id: canonicalIdentifierSchema,
  unitPriceMinor: positiveMvpMoneySchema,
  quantity: quantitySchema,
  label: z.optional(canonicalLabelSchema),
  priceSource: priceSourceV1Schema,
  priceConfidence: priceConfidenceV1Schema,
  createdAt: canonicalIsoTimestampSchema,
  updatedAt: canonicalIsoTimestampSchema,
});

export const activeTripDataV1Schema = z.strictObject({
  id: canonicalIdentifierSchema,
  status: z.literal("active"),
  currency: z.literal("EUR"),
  budgetMinor: positiveMvpMoneySchema,
  safetyBufferMinor: nonNegativeMvpMoneySchema,
  startedAt: canonicalIsoTimestampSchema,
  items: z.array(cartItemV1Schema),
});

export const completedTripDataV1Schema = z.strictObject({
  id: canonicalIdentifierSchema,
  status: z.literal("completed"),
  currency: z.literal("EUR"),
  budgetMinor: positiveMvpMoneySchema,
  safetyBufferMinor: nonNegativeMvpMoneySchema,
  startedAt: canonicalIsoTimestampSchema,
  completedAt: canonicalIsoTimestampSchema,
  actualCheckoutMinor: z.optional(nonNegativeMvpMoneySchema),
  items: z.array(cartItemV1Schema),
});

export const historyDataEnvelopeV1Schema = z.strictObject({
  trips: z.array(z.unknown()),
});

export const storageEnvelopeHeaderSchema = z.looseObject({
  schemaVersion: z.int().check(z.minimum(1)),
});

export const storageEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(CURRENT_ACTIVE_TRIP_SCHEMA_VERSION),
  savedAt: canonicalIsoTimestampSchema,
  data: z.unknown(),
});

export const historyStorageEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal(CURRENT_HISTORY_SCHEMA_VERSION),
  savedAt: canonicalIsoTimestampSchema,
  data: z.unknown(),
});

export type PriceSourceV1 = z.infer<typeof priceSourceV1Schema>;
export type PriceConfidenceV1 = z.infer<typeof priceConfidenceV1Schema>;
export type CartItemV1 = z.infer<typeof cartItemV1Schema>;
export type ActiveTripDataV1 = z.infer<typeof activeTripDataV1Schema>;

export type CompletedTripDataV1 = z.infer<typeof completedTripDataV1Schema>;

export interface ActiveTripEnvelopeV1 {
  readonly schemaVersion: typeof CURRENT_ACTIVE_TRIP_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly data: ActiveTripDataV1;
}

export interface HistoryEnvelopeV1 {
  readonly schemaVersion: typeof CURRENT_HISTORY_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly data: {
    readonly trips: readonly CompletedTripDataV1[];
  };
}
