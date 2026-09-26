import { ok, type Result } from "./money";
import {
  productIdFromLabel,
  type PriceMemoryRecord,
} from "./price-memory";
import { isGtin, type Gtin } from "./product-code";
import {
  MAX_ITEM_LABEL_CODE_POINTS,
  isoTimestamp,
  type IsoTimestamp,
} from "./shopping-trip";

export const MAX_BARCODE_LINKS = 500;

export interface BarcodeLink {
  readonly gtin: Gtin;
  readonly label: string;
  readonly linkedAt: IsoTimestamp;
}

export interface BarcodeLinkError {
  readonly kind: "barcode-link";
  readonly code: "invalid-gtin" | "invalid-label" | "invalid-timestamp";
}

const linkError = (
  code: BarcodeLinkError["code"],
): Result<never, BarcodeLinkError> => ({
  ok: false,
  error: { kind: "barcode-link", code },
});

export const normalizeProductLabel = (value: string): string | null => {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");

  return normalized === "" ||
    [...normalized].length > MAX_ITEM_LABEL_CODE_POINTS
    ? null
    : normalized;
};

export const createBarcodeLink = (input: {
  readonly gtin: string;
  readonly label: string;
  readonly linkedAt: string;
}): Result<BarcodeLink, BarcodeLinkError> => {
  if (!isGtin(input.gtin)) {
    return linkError("invalid-gtin");
  }

  const label = normalizeProductLabel(input.label);

  if (label === null) {
    return linkError("invalid-label");
  }

  const linkedAt = isoTimestamp(input.linkedAt);

  if (!linkedAt.ok) {
    return linkError("invalid-timestamp");
  }

  return ok({ gtin: input.gtin, label, linkedAt: linkedAt.value });
};

export const findBarcodeLink = (
  links: readonly BarcodeLink[],
  gtin: Gtin,
): BarcodeLink | null =>
  links.find((candidate) => candidate.gtin === gtin) ?? null;

export const upsertBarcodeLink = (
  links: readonly BarcodeLink[],
  link: BarcodeLink,
): readonly BarcodeLink[] => {
  const current = findBarcodeLink(links, link.gtin);

  if (current !== null && current.label === link.label) {
    return links;
  }

  if (current !== null && Date.parse(link.linkedAt) < Date.parse(current.linkedAt)) {
    return links;
  }

  const others = links.filter((candidate) => candidate.gtin !== link.gtin);
  const next = [...others, link].sort(
    (left, right) => Date.parse(right.linkedAt) - Date.parse(left.linkedAt),
  );

  return Object.freeze(next.slice(0, MAX_BARCODE_LINKS));
};

export const rememberedPriceForLabel = (
  records: readonly PriceMemoryRecord[],
  label: string,
): PriceMemoryRecord | null => {
  const productId = productIdFromLabel(label);

  if (!productId.ok) {
    return null;
  }

  let best: PriceMemoryRecord | null = null;

  for (const record of records) {
    if (
      record.productId === productId.value &&
      (best === null ||
        Date.parse(record.observedAt) > Date.parse(best.observedAt))
    ) {
      best = record;
    }
  }

  return best;
};
