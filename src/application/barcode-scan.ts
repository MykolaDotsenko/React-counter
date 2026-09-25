import { parseProductCode, type ProductCode } from "../domain/product-code";
import type { BarcodeReading } from "./barcode-ports";

export interface StableReading {
  readonly reading: BarcodeReading;
  readonly code: ProductCode;
}

export interface ScanStabilizer {
  readonly accept: (
    readings: readonly BarcodeReading[],
    nowMs: number,
  ) => StableReading | null;
  readonly reset: () => void;
}

const identityOf = (code: ProductCode, reading: BarcodeReading): string =>
  code.kind === "trade-item"
    ? code.gtin
    : `${code.kind}:${reading.rawValue.replace(/[\s-]/gu, "")}`;

export const createScanStabilizer = ({
  requiredMatches = 2,
  windowMs = 1_500,
}: {
  readonly requiredMatches?: number;
  readonly windowMs?: number;
} = {}): ScanStabilizer => {
  let candidate: { identity: string; count: number; firstSeenMs: number } | null =
    null;

  return {
    accept(readings, nowMs) {
      for (const reading of readings) {
        const parsed = parseProductCode(reading.rawValue, reading.symbology);

        if (!parsed.ok) {
          continue;
        }

        const identity = identityOf(parsed.value, reading);

        if (
          candidate === null ||
          candidate.identity !== identity ||
          nowMs - candidate.firstSeenMs > windowMs
        ) {
          candidate = { identity, count: 1, firstSeenMs: nowMs };
        } else {
          candidate = { ...candidate, count: candidate.count + 1 };
        }

        if (candidate.count >= requiredMatches) {
          candidate = null;
          return { reading, code: parsed.value };
        }

        return null;
      }

      return null;
    },
    reset() {
      candidate = null;
    },
  };
};
