import type {
  Clock,
  IdGenerator,
} from "../../application/shopping-app-controller";
import { isoTimestamp } from "../../domain/shopping-trip";

export const systemClock: Clock = {
  now() {
    const timestamp = isoTimestamp(new Date().toISOString());

    if (!timestamp.ok) {
      throw new Error("System clock produced an invalid ISO timestamp");
    }

    return timestamp.value;
  },
};

const randomUuid = (): string => {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.randomUUID !== "function"
  ) {
    throw new Error("crypto.randomUUID() is required by the shopping app");
  }

  return globalThis.crypto.randomUUID();
};

export const cryptoIdGenerator: IdGenerator = {
  tripId: randomUuid,
  itemId: randomUuid,
};
