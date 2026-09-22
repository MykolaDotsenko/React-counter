import type {
  PriceMemoryBootstrapResult,
  PriceMemoryPersistencePort,
  PriceMemoryPersistenceProblem,
  PriceMemorySaveResult,
} from "../../application/price-memory-port";
import type { PriceMemoryRecord } from "../../domain/price-memory";
import type { IsoTimestamp } from "../../domain/shopping-trip";
import {
  restorePriceMemory,
  writePriceMemory,
  type PriceMemoryPersistenceIssue,
} from "./price-memory-storage";
import type { StorageLike } from "./shopping-storage";

const toProblem = (
  issue: PriceMemoryPersistenceIssue,
): PriceMemoryPersistenceProblem => ({
  code: issue.code,
  storageKey: issue.storageKey,
  ...(issue.schemaVersion === undefined
    ? {}
    : { schemaVersion: issue.schemaVersion }),
});

export const createPriceMemoryPersistencePort = (
  storage: StorageLike | null | undefined,
): PriceMemoryPersistencePort => ({
  bootstrap(): PriceMemoryBootstrapResult {
    const result = restorePriceMemory(storage);

    if (result.health === "healthy") {
      return {
        ok: true,
        records: result.records,
      };
    }

    return {
      ok: false,
      records: result.records,
      issue: toProblem(result.issue),
    };
  },

  save(
    records: readonly PriceMemoryRecord[],
    savedAt: IsoTimestamp,
  ): PriceMemorySaveResult {
    const result = writePriceMemory(storage, records, savedAt);

    if (result.health === "healthy") {
      return { ok: true };
    }

    return {
      ok: false,
      issue: toProblem(result.issue),
    };
  },
});
