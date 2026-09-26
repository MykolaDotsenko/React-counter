import type { RefObject } from "react";

import { formatEur, type MinorUnits } from "../../domain/money";
import type { PriceTagCandidate } from "../../domain/shelf-price";
import {
  candidateContextLabel,
  priceProblemCopy,
  type PriceReadProblem,
} from "./scan-copy";
import styles from "./ScanSurface.module.css";

const MAX_SHOWN_PRICE_CANDIDATES = 4;

export type PriceReadOutcome =
  | {
      readonly kind: "prices";
      readonly candidates: readonly PriceTagCandidate[];
    }
  | { readonly kind: "problem"; readonly problem: PriceReadProblem };

export interface ScanPriceResultProps {
  readonly outcome: PriceReadOutcome;
  readonly productLabel: string | null;
  readonly capturedUrl: string | null;
  readonly locale: string;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly onChoose: (price: MinorUnits) => void;
  readonly onRetake: () => void;
  readonly onTypePrice: () => void;
}

export function ScanPriceResult({
  outcome,
  productLabel,
  capturedUrl,
  locale,
  headingRef,
  onChoose,
  onRetake,
  onTypePrice,
}: ScanPriceResultProps) {
  const snapshot =
    capturedUrl === null ? null : (
      <img
        className={styles.snapshot}
        src={capturedUrl}
        alt="The price tag as captured"
      />
    );

  if (outcome.kind === "problem") {
    return (
      <section className={styles.result} aria-labelledby="scan-result-title">
        <h2 id="scan-result-title" ref={headingRef} tabIndex={-1}>
          {outcome.problem === "engine-failed"
            ? "Price reader unavailable"
            : "No price found"}
        </h2>
        {snapshot}
        <p>{priceProblemCopy(outcome.problem)}</p>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={onRetake}>
            Try again
          </button>
          <button type="button" className={styles.secondary} onClick={onTypePrice}>
            Type price
          </button>
        </div>
      </section>
    );
  }

  const shown = outcome.candidates.slice(0, MAX_SHOWN_PRICE_CANDIDATES);

  return (
    <section className={styles.result} aria-labelledby="scan-result-title">
      <h2 id="scan-result-title" ref={headingRef} tabIndex={-1}>
        {productLabel === null ? "Choose the price" : `Price for ${productLabel}`}
      </h2>
      {snapshot}
      <p>
        Tap the amount that matches the shelf. You&apos;ll check it once more
        before it&apos;s added.
      </p>
      <ul className={styles.candidates} aria-label="Prices found on the tag">
        {shown.map((candidate, index) => {
          const tag = candidateContextLabel(candidate);

          return (
            <li key={Number(candidate.minorUnits)}>
              <button
                type="button"
                className={index === 0 ? styles.candidatePrimary : styles.candidate}
                onClick={() => {
                  onChoose(candidate.minorUnits);
                }}
              >
                <span className={styles.amount}>
                  {formatEur(candidate.minorUnits, locale)}
                </span>
                {tag === null ? null : (
                  <span className={styles.tag}>{tag}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className={styles.row}>
        <button type="button" className={styles.secondary} onClick={onRetake}>
          Retake
        </button>
        <button type="button" className={styles.secondary} onClick={onTypePrice}>
          Type price
        </button>
      </div>
    </section>
  );
}
