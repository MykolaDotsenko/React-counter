import type { MoneyDraftMode } from "../../domain/money";
import styles from "./PriceEntrySurface.module.css";

const KEYPAD_ROWS: readonly (readonly string[])[] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "backspace"],
] as const;

export interface PriceKeypadProps {
  readonly mode: MoneyDraftMode;
  readonly onPress: (key: string) => void;
}

export function PriceKeypad({
  mode,
  onPress,
}: PriceKeypadProps) {
  return (
    <div className={styles.keypad} aria-label="Price keypad">
      {KEYPAD_ROWS.flat().map((key) => {
        const isSeparator = key === ".";
        const isBackspace = key === "backspace";

        if (isSeparator && mode === "auto-cents") {
          return (
            <button
              key={key}
              type="button"
              className={styles.key}
              disabled
              aria-label="Decimal separator unavailable in cents mode"
            >
              .
            </button>
          );
        }

        return (
          <button
            key={key}
            type="button"
            className={styles.key}
            aria-label={
              isBackspace
                ? "Backspace"
                : isSeparator
                  ? "Decimal separator"
                  : `Digit ${key}`
            }
            onClick={() => {
              onPress(key);
            }}
          >
            {isBackspace ? "⌫" : key}
          </button>
        );
      })}
    </div>
  );
}
