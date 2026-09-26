import { useEffect, useId, useRef, useState, type RefObject } from "react";

import type { ProductLookupPort } from "../../application/barcode-ports";
import type { BarcodeIdentification } from "../../application/shopping-app-controller";
import { normalizeProductLabel } from "../../domain/barcode-link";
import { formatEur } from "../../domain/money";
import type { PriceMemoryRecord } from "../../domain/price-memory";
import { gtinForDisplay, type Gtin } from "../../domain/product-code";
import { lookupCopy, type LookupState } from "./scan-copy";
import {
  contextTarget,
  type PriceEntryTarget,
  type ScanContext,
} from "./scan-targets";
import styles from "./ScanSurface.module.css";

export type Identified = Extract<BarcodeIdentification, { readonly ok: true }>;

export interface ScanBarcodeResultProps {
  readonly result: Identified;
  readonly productLookup: ProductLookupPort | null;
  readonly canReadPriceTag: boolean;
  readonly locale: string;
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly onEnterPrice: (target: PriceEntryTarget) => void;
  readonly onReadPriceTag: (context: ScanContext) => void;
  readonly onUseRemembered: (
    record: PriceMemoryRecord,
    barcode: Gtin,
  ) => boolean;
  readonly onScanAnother: () => void;
}

export function ScanBarcodeResult({
  result,
  productLookup,
  canReadPriceTag,
  locale,
  headingRef,
  onEnterPrice,
  onReadPriceTag,
  onUseRemembered,
  onScanAnother,
}: ScanBarcodeResultProps) {
  const nameId = useId();
  const lookupAbortRef = useRef<AbortController | null>(null);
  const [name, setName] = useState(result.label ?? "");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [actionError, setActionError] = useState("");

  useEffect(
    () => () => {
      lookupAbortRef.current?.abort();
    },
    [],
  );

  const code = result.code;

  const priceActions = (context: ScanContext, typeLabel: string) => (
    <>
      {canReadPriceTag ? (
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            onReadPriceTag(context);
          }}
        >
          Read price tag
        </button>
      ) : null}
      <button
        type="button"
        className={canReadPriceTag ? styles.secondary : styles.primary}
        onClick={() => {
          onEnterPrice(context);
        }}
      >
        {typeLabel}
      </button>
    </>
  );

  if (code.kind === "in-store") {
    return (
      <section className={styles.result} aria-labelledby="scan-result-title">
        <h2 id="scan-result-title" ref={headingRef} tabIndex={-1}>
          Store label code
        </h2>
        <p>
          The store printed this barcode, for example for a weighed item. It
          changes from pack to pack, so it can&apos;t be remembered. Use the
          price on the label.
        </p>
        <div className={styles.row}>
          {priceActions({}, "Enter price")}
          <button type="button" className={styles.secondary} onClick={onScanAnother}>
            Scan another
          </button>
        </div>
      </section>
    );
  }

  if (code.kind === "coupon") {
    return (
      <section className={styles.result} aria-labelledby="scan-result-title">
        <h2 id="scan-result-title" ref={headingRef} tabIndex={-1}>
          Not a product barcode
        </h2>
        <p>This looks like a coupon or receipt code.</p>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={onScanAnother}>
            Scan another
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              onEnterPrice({});
            }}
          >
            Enter price without scanning
          </button>
        </div>
      </section>
    );
  }

  const gtin = code.gtin;
  const displayCode = gtinForDisplay(gtin);
  const knownLabel = result.label;

  if (knownLabel !== null) {
    const remembered = result.remembered;

    return (
      <section className={styles.result} aria-labelledby="scan-result-title">
        <h2 id="scan-result-title" ref={headingRef} tabIndex={-1}>
          {knownLabel}
        </h2>
        <p className={styles.code}>Barcode {displayCode}</p>
        <p>
          {remembered === null
            ? "No remembered price yet. Use the price on the shelf."
            : `Last time ${formatEur(remembered.unitPriceMinor, locale)}. Prices change, so check the shelf.`}
        </p>
        <div className={styles.actions}>
          {priceActions(
            contextTarget(knownLabel, gtin),
            canReadPriceTag ? "Type current price" : "Enter current price",
          )}
          {remembered !== null ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setActionError("");

                if (!onUseRemembered(remembered, gtin)) {
                  setActionError("Couldn't add it. Enter the price instead.");
                }
              }}
            >
              {`Use ${formatEur(remembered.unitPriceMinor, locale)} again`}
            </button>
          ) : null}
          <button type="button" className={styles.secondary} onClick={onScanAnother}>
            Scan another
          </button>
        </div>
        {actionError ? (
          <p className={styles.error} role="alert">
            {actionError}
          </p>
        ) : null}
      </section>
    );
  }

  const findNameOnline = (): void => {
    if (productLookup === null) {
      return;
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    setLookup({ kind: "loading" });

    void productLookup
      .lookup(gtin, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) {
          return;
        }

        setLookup({ kind: "done", result: found });

        if (found.status === "found") {
          setName(found.product.name);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLookup({
            kind: "done",
            result: { status: "failed", reason: "unavailable" },
          });
        }
      });
  };

  const namedContext = (): ScanContext =>
    contextTarget(normalizeProductLabel(name), gtin);

  return (
    <section className={styles.result} aria-labelledby="scan-result-title">
      <h2 id="scan-result-title" ref={headingRef} tabIndex={-1}>
        New product
      </h2>
      <p className={styles.code}>Barcode {displayCode}</p>
      <label className={styles.field} htmlFor={nameId}>
        Name for next time (optional)
        <input
          id={nameId}
          value={name}
          autoComplete="off"
          spellCheck={false}
          placeholder="Milk 1L"
          maxLength={120}
          onChange={(event) => {
            setName(event.currentTarget.value);
          }}
        />
      </label>
      {productLookup !== null ? (
        <>
          <button
            type="button"
            className={styles.secondary}
            disabled={lookup.kind === "loading"}
            onClick={findNameOnline}
          >
            {lookup.kind === "loading" ? "Looking up…" : "Find name online"}
          </button>
          <p className={styles.note}>
            {`Sends only this barcode number to ${productLookup.providerName}. Nothing else leaves your device.`}
          </p>
          <p className={styles.note} role="status" aria-live="polite">
            {lookupCopy(lookup, productLookup.providerName)}
          </p>
        </>
      ) : null}
      <div className={styles.row}>
        {canReadPriceTag ? (
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              onReadPriceTag(namedContext());
            }}
          >
            Read price tag
          </button>
        ) : null}
        <button
          type="button"
          className={canReadPriceTag ? styles.secondary : styles.primary}
          onClick={() => {
            onEnterPrice(namedContext());
          }}
        >
          {canReadPriceTag ? "Type price" : "Continue to price"}
        </button>
        <button type="button" className={styles.secondary} onClick={onScanAnother}>
          Scan another
        </button>
      </div>
    </section>
  );
}
