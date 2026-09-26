import type { PriceTagCandidate } from "../domain/shelf-price";

export type PriceTagReaderFailure = "engine-failed" | "timeout";

export type PriceTagReadResult =
  | {
      readonly status: "read";
      readonly candidates: readonly PriceTagCandidate[];
    }
  | { readonly status: "no-price" }
  | { readonly status: "failed"; readonly reason: PriceTagReaderFailure };

export interface PriceTagReaderProgress {
  readonly fraction: number | null;
}

export interface PriceTagReaderPort {
  readonly prepare: (
    onProgress?: (progress: PriceTagReaderProgress) => void,
  ) => Promise<boolean>;
  readonly read: (
    image: Blob,
    signal: AbortSignal,
  ) => Promise<PriceTagReadResult>;
  readonly release: () => void;
}
