import { useEffect, useEffectEvent, useId, useRef, useState } from "react";

import type {
  BarcodeReading,
  BarcodeScannerPort,
  ProductLookupPort,
  ProductLookupResult,
  ScannerFailure,
  ScannerSession,
  TorchControl,
} from "../../application/barcode-ports";
import { createScanStabilizer } from "../../application/barcode-scan";
import type {
  BarcodeIdentification,
  ShoppingAppController,
} from "../../application/shopping-app-controller";
import { normalizeProductLabel } from "../../domain/barcode-link";
import { formatEur } from "../../domain/money";
import type { PriceMemoryRecord } from "../../domain/price-memory";
import {
  gtinForDisplay,
  type Gtin,
  type ProductCodeError,
} from "../../domain/product-code";
import styles from "./BarcodeScanSurface.module.css";
import { SHOPPING_LOCALE } from "./shopping-locale";

export interface PriceEntryTarget {
  readonly label?: string;
  readonly barcode?: Gtin;
}

export interface BarcodeScanSurfaceProps {
  readonly controller: ShoppingAppController;
  readonly scanner: BarcodeScannerPort;
  readonly productLookup: ProductLookupPort | null;
  readonly onCancel: () => void;
  readonly onEnterPrice: (target: PriceEntryTarget) => void;
  readonly onUseRemembered: (
    record: PriceMemoryRecord,
    barcode: Gtin,
  ) => boolean;
  readonly locale?: string;
}

type Identified = Extract<BarcodeIdentification, { readonly ok: true }>;

type Phase =
  | { readonly kind: "starting" }
  | {
      readonly kind: "scanning";
      readonly hint: boolean;
      readonly torch: TorchControl | null;
      readonly torchOn: boolean;
    }
  | { readonly kind: "paused" }
  | { readonly kind: "failed"; readonly failure: ScannerFailure }
  | { readonly kind: "typing" }
  | { readonly kind: "found"; readonly result: Identified };

type LookupState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "done"; readonly result: ProductLookupResult };

const SCAN_INTERVAL_MS = 90;
const HINT_AFTER_MS = 8_000;
const MAX_CONSECUTIVE_DETECT_ERRORS = 5;

const failureCopy = (failure: ScannerFailure): string => {
  switch (failure) {
    case "permission-denied":
      return "Camera access is blocked. Allow the camera for this site in your browser settings, or type the barcode instead.";
    case "insecure-context":
      return "The camera needs a secure (https) connection. Type the barcode instead.";
    case "unsupported":
      return "This browser can't use the camera here. Type the barcode instead.";
    case "no-camera":
      return "No camera was found on this device. Type the barcode instead.";
    case "camera-busy":
      return "Another app is using the camera. Close it and try again.";
    case "engine-failed":
      return "The barcode reader couldn't load. Check your connection and try again.";
    case "camera-error":
      return "The camera couldn't start. Try again or type the barcode.";
    default: {
      const exhaustive: never = failure;
      return exhaustive;
    }
  }
};

const canRetry = (failure: ScannerFailure): boolean =>
  failure === "permission-denied" ||
  failure === "camera-busy" ||
  failure === "engine-failed" ||
  failure === "camera-error";

const codeErrorCopy = (error: ProductCodeError): string => {
  switch (error.code) {
    case "invalid-characters":
      return "Use the digits under the barcode only.";
    case "invalid-length":
      return "Product barcodes have 8, 12 or 13 digits.";
    case "invalid-check-digit":
      return "Those digits don't form a valid barcode. Check them and try again.";
    default: {
      const exhaustive: never = error.code;
      return exhaustive;
    }
  }
};

const lookupCopy = (state: LookupState, provider: string): string => {
  if (state.kind === "loading") {
    return `Looking up this barcode in ${provider}…`;
  }

  if (state.kind !== "done") {
    return "";
  }

  switch (state.result.status) {
    case "found":
      return `Suggested by ${provider}. Check that it matches the product.`;
    case "not-found":
      return `${provider} doesn't know this barcode. Type a name or continue without one.`;
    case "failed":
      return state.result.reason === "offline"
        ? "You're offline. Type a name or continue without one."
        : `Couldn't reach ${provider}. Try again, type a name or continue without one.`;
    default: {
      const exhaustive: never = state.result;
      return exhaustive;
    }
  }
};

export default function BarcodeScanSurface({
  controller,
  scanner,
  productLookup,
  onCancel,
  onEnterPrice,
  onUseRemembered,
  locale = SHOPPING_LOCALE,
}: BarcodeScanSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const manualId = useId();
  const nameId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [cameraRun, setCameraRun] = useState(1);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");
  const [name, setName] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [actionError, setActionError] = useState("");
  const cameraWanted =
    phase.kind === "starting" || phase.kind === "scanning";

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (phase.kind === "found" || phase.kind === "failed") {
      resultRef.current?.focus();
    }

    if (phase.kind === "typing") {
      manualInputRef.current?.focus();
    }
  }, [phase.kind]);

  useEffect(
    () => () => {
      lookupAbortRef.current?.abort();
    },
    [],
  );

  const showIdentification = (reading: BarcodeReading): void => {
    const result = controller.identifyBarcode(
      reading.rawValue,
      reading.symbology,
    );

    if (result.ok) {
      setName(result.label ?? "");
      setLookup({ kind: "idle" });
      setActionError("");
      setPhase({ kind: "found", result });
    }
  };

  const onStableReading = useEffectEvent((reading: BarcodeReading) => {
    showIdentification(reading);
  });

  const onEscape = useEffectEvent(() => {
    onCancel();
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onEscape();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (cameraRun === 0 || video === null) {
      return;
    }

    let cancelled = false;
    let session: ScannerSession | null = null;
    let loopTimer: number | undefined;
    let hintTimer: number | undefined;
    const stabilizer = createScanStabilizer();

    void scanner.start(video).then((started) => {
      if (cancelled) {
        if (started.ok) {
          started.session.stop();
        }
        return;
      }

      if (!started.ok) {
        setPhase({ kind: "failed", failure: started.failure });
        return;
      }

      const active = started.session;
      session = active;
      setPhase({
        kind: "scanning",
        hint: false,
        torch: active.torch,
        torchOn: false,
      });
      hintTimer = window.setTimeout(() => {
        setPhase((current) =>
          current.kind === "scanning" ? { ...current, hint: true } : current,
        );
      }, HINT_AFTER_MS);

      let consecutiveErrors = 0;
      const tick = async (): Promise<void> => {
        if (cancelled) {
          return;
        }

        let readings: readonly BarcodeReading[] = [];

        try {
          readings = await active.detect();
          consecutiveErrors = 0;
        } catch {
          consecutiveErrors += 1;
        }

        if (cancelled) {
          return;
        }

        if (consecutiveErrors >= MAX_CONSECUTIVE_DETECT_ERRORS) {
          active.stop();
          session = null;
          setPhase({ kind: "failed", failure: "engine-failed" });
          return;
        }

        const stable = stabilizer.accept(readings, performance.now());

        if (stable !== null) {
          active.stop();
          session = null;
          navigator.vibrate?.(40);
          onStableReading(stable.reading);
          return;
        }

        loopTimer = window.setTimeout(() => {
          void tick();
        }, SCAN_INTERVAL_MS);
      };

      void tick();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loopTimer);
      window.clearTimeout(hintTimer);
      session?.stop();
    };
  }, [cameraRun, scanner]);

  useEffect(() => {
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") {
        setCameraRun(0);
        setPhase((current) =>
          current.kind === "starting" || current.kind === "scanning"
            ? { kind: "paused" }
            : current,
        );
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const restartCamera = (): void => {
    lookupAbortRef.current?.abort();
    setManualError("");
    setPhase({ kind: "starting" });
    setCameraRun((current) => current + 1);
    titleRef.current?.focus();
  };

  const stopCamera = (): void => {
    setCameraRun(0);
  };

  const typeInstead = (): void => {
    stopCamera();
    setManualError("");
    setPhase({ kind: "typing" });
  };

  const submitManual = (): void => {
    const result = controller.identifyBarcode(manualCode, null);

    if (!result.ok) {
      setManualError(codeErrorCopy(result.error));
      return;
    }

    setManualError("");
    showIdentification({ rawValue: manualCode, symbology: null });
  };

  const toggleTorch = (): void => {
    if (phase.kind !== "scanning" || phase.torch === null) {
      return;
    }

    const next = !phase.torchOn;

    void phase.torch.set(next).then((applied) => {
      if (applied) {
        setPhase((current) =>
          current.kind === "scanning" ? { ...current, torchOn: next } : current,
        );
      }
    });
  };

  const findNameOnline = (gtin: Gtin): void => {
    if (productLookup === null) {
      return;
    }

    lookupAbortRef.current?.abort();
    const controllerSignal = new AbortController();
    lookupAbortRef.current = controllerSignal;
    setLookup({ kind: "loading" });

    void productLookup
      .lookup(gtin, controllerSignal.signal)
      .then((result) => {
        if (controllerSignal.signal.aborted) {
          return;
        }

        setLookup({ kind: "done", result });

        if (result.status === "found") {
          setName(result.product.name);
        }
      })
      .catch(() => {
        if (!controllerSignal.signal.aborted) {
          setLookup({
            kind: "done",
            result: { status: "failed", reason: "unavailable" },
          });
        }
      });
  };

  const continueToPrice = (gtin: Gtin): void => {
    const label = normalizeProductLabel(name);
    onEnterPrice(label === null ? { barcode: gtin } : { label, barcode: gtin });
  };

  const statusText =
    phase.kind === "starting"
      ? "Starting the camera…"
      : phase.kind === "scanning"
        ? phase.hint
          ? "Hold the barcode flat and steady, about 10–20 cm from the camera."
          : "Point the camera at the barcode."
        : phase.kind === "paused"
          ? "Camera paused while the app was in the background."
          : phase.kind === "found"
            ? "Barcode read."
            : "";

  const renderFound = (result: Identified) => {
    const code = result.code;

    if (code.kind === "in-store") {
      return (
        <section className={styles.result} aria-labelledby="scan-result-title">
          <h2 id="scan-result-title" ref={resultRef} tabIndex={-1}>
            Store label code
          </h2>
          <p>
            The store printed this barcode, for example for a weighed item. It
            changes from pack to pack, so it can&apos;t be remembered. Enter the
            price from the label.
          </p>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                onEnterPrice({});
              }}
            >
              Enter price
            </button>
            <button type="button" className={styles.secondary} onClick={restartCamera}>
              Scan another
            </button>
          </div>
        </section>
      );
    }

    if (code.kind === "coupon") {
      return (
        <section className={styles.result} aria-labelledby="scan-result-title">
          <h2 id="scan-result-title" ref={resultRef} tabIndex={-1}>
            Not a product barcode
          </h2>
          <p>This looks like a coupon or receipt code.</p>
          <div className={styles.row}>
            <button type="button" className={styles.primary} onClick={restartCamera}>
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
          <h2 id="scan-result-title" ref={resultRef} tabIndex={-1}>
            {knownLabel}
          </h2>
          <p className={styles.code}>Barcode {displayCode}</p>
          <p>
            {remembered === null
              ? "No remembered price yet. Enter the price on the shelf."
              : `Last time ${formatEur(remembered.unitPriceMinor, locale)}. Prices change, so check the shelf.`}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                onEnterPrice({ label: knownLabel, barcode: gtin });
              }}
            >
              Enter current price
            </button>
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
            <button type="button" className={styles.secondary} onClick={restartCamera}>
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

    return (
      <section className={styles.result} aria-labelledby="scan-result-title">
        <h2 id="scan-result-title" ref={resultRef} tabIndex={-1}>
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
              onClick={() => {
                findNameOnline(gtin);
              }}
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
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              continueToPrice(gtin);
            }}
          >
            Continue to price
          </button>
          <button type="button" className={styles.secondary} onClick={restartCamera}>
            Scan another
          </button>
        </div>
      </section>
    );
  };

  return (
    <main className={styles.screen} aria-labelledby="barcode-scan-title">
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Scan barcode</p>
            <h1 id="barcode-scan-title" ref={titleRef} tabIndex={-1}>
              Find the product
            </h1>
          </div>
          <button type="button" className={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
        </header>

        <div className={styles.viewport} hidden={!cameraWanted}>
          <video ref={videoRef} muted playsInline aria-label="Camera preview" />
          <div className={styles.frame} aria-hidden="true" />
        </div>

        <p className={styles.status} role="status" aria-live="polite">
          {statusText}
        </p>

        {cameraWanted ? (
          <>
            <p className={styles.note}>
              The camera image stays on this device.
            </p>
            <div className={styles.row}>
              {phase.kind === "scanning" && phase.torch !== null ? (
                <button
                  type="button"
                  className={styles.secondary}
                  aria-pressed={phase.torchOn}
                  onClick={toggleTorch}
                >
                  Light
                </button>
              ) : null}
              <button type="button" className={styles.secondary} onClick={typeInstead}>
                Type barcode
              </button>
            </div>
          </>
        ) : null}

        {phase.kind === "paused" ? (
          <button type="button" className={styles.primary} onClick={restartCamera}>
            Resume camera
          </button>
        ) : null}

        {phase.kind === "failed" ? (
          <section className={styles.result} aria-labelledby="scan-result-title">
            <h2 id="scan-result-title" ref={resultRef} tabIndex={-1}>
              Camera unavailable
            </h2>
            <p>{failureCopy(phase.failure)}</p>
            <div className={styles.actions}>
              {canRetry(phase.failure) ? (
                <button type="button" className={styles.primary} onClick={restartCamera}>
                  Try again
                </button>
              ) : null}
              <button type="button" className={styles.secondary} onClick={typeInstead}>
                Type barcode
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
        ) : null}

        {phase.kind === "typing" ? (
          <form
            className={styles.result}
            onSubmit={(event) => {
              event.preventDefault();
              submitManual();
            }}
          >
            <label className={styles.field} htmlFor={manualId}>
              Barcode digits
              <input
                ref={manualInputRef}
                id={manualId}
                value={manualCode}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={16}
                aria-invalid={Boolean(manualError)}
                onChange={(event) => {
                  setManualCode(event.currentTarget.value);
                  setManualError("");
                }}
              />
            </label>
            {manualError ? (
              <p className={styles.error} role="alert">
                {manualError}
              </p>
            ) : null}
            <div className={styles.row}>
              <button type="submit" className={styles.primary}>
                Look up barcode
              </button>
              {scanner.isAvailable() ? (
                <button type="button" className={styles.secondary} onClick={restartCamera}>
                  Use camera
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {phase.kind === "found" ? renderFound(phase.result) : null}
      </div>
    </main>
  );
}
