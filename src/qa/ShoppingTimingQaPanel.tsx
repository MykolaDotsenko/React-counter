import { useEffect, useMemo, useState } from "react";

import {
  QA_TARGET_SAMPLE_COUNT,
  summarizeQaEmpiricalGate,
  summarizeQaTimingSamples,
  type QaChecklistKey,
  type QaPhysicalContext,
  type QaSpotChecks,
  type QaSpotCheckStatus,
  type QaTimingSession,
} from "./shopping-timing";
import styles from "./ShoppingTimingQaPanel.module.css";

export interface ShoppingTimingQaPanelProps {
  readonly session: QaTimingSession;
  readonly onChecklistChange: (
    key: QaChecklistKey,
    value: boolean,
  ) => void;
  readonly onDeviceLabelChange: (value: string) => void;
  readonly onCompactDeviceLabelChange: (value: string) => void;
  readonly onInputMethodLabelChange: (value: string) => void;
  readonly onPhysicalContextChange: (
    key: keyof QaPhysicalContext,
    value: boolean,
  ) => void;
  readonly onSpotCheckChange: (
    key: keyof QaSpotChecks,
    value: QaSpotCheckStatus,
  ) => void;
  readonly onNotesChange: (value: string) => void;
  readonly onResetSamples: () => void;
}

const PHYSICAL_CONTEXT: readonly {
  readonly key: keyof QaPhysicalContext;
  readonly label: string;
}[] = [
  {
    key: "oneHanded",
    label: "Primary timing set was completed one-handed",
  },
  {
    key: "brightStoreLikeLighting",
    label: "Primary timing set was completed in bright/store-like lighting",
  },
  {
    key: "defaultTextSize",
    label: "Primary timing set used the default system text size",
  },
] as const;

const SPOT_CHECKS: readonly {
  readonly key: keyof QaSpotChecks;
  readonly label: string;
}[] = [
  {
    key: "darkAppearance",
    label: "Dark appearance",
  },
  {
    key: "largeText200",
    label: "200% / large text",
  },
  {
    key: "reducedMotion",
    label: "Reduced motion",
  },
] as const;

const CHECKLIST: readonly {
  readonly key: QaChecklistKey;
  readonly label: string;
}[] = [
  {
    key: "addPriceReachable",
    label: "Add price is comfortably thumb reachable",
  },
  {
    key: "numericKeysReachable",
    label: "Numeric keys are comfortably reachable",
  },
  {
    key: "cancelReachable",
    label: "Cancel is reachable without destabilizing grip",
  },
  {
    key: "projectionReadable",
    label: "Projected remaining is readable before commit",
  },
  {
    key: "reserveWithoutColour",
    label: "Reserve/over-budget state is clear without colour",
  },
  {
    key: "addPlacementStable",
    label: "Add stays in a predictable place",
  },
  {
    key: "keypadCloses",
    label: "Keypad closes after commit",
  },
  {
    key: "brightSummaryReadable",
    label: "Summary is readable in bright/store-like light",
  },
  {
    key: "softwareKeyboardClear",
    label: "Software keyboard does not obscure critical controls",
  },
  {
    key: "repeatedAddNoScroll",
    label: "Ordinary repeated add does not require scrolling",
  },
  {
    key: "typoCorrectionWorks",
    label: "One obvious typo can be corrected before commit",
  },
  {
    key: "fiveConsecutiveAddsSmooth",
    label: "Five consecutive ordinary adds stay stable and understandable",
  },
  {
    key: "consistentInputMethod",
    label: "The same input method was used for comparable timing samples",
  },
  {
    key: "compactSpotCheckRecorded",
    label: "Compact ~360×800 phone/equivalent spot-check was completed",
  },
] as const;

const seconds = (value: number | null): string =>
  value === null ? "—" : `${(value / 1_000).toFixed(2)} s`;

const statusLabel = (
  status: ReturnType<typeof summarizeQaTimingSamples>["status"],
): string => {
  switch (status) {
    case "pending":
      return "Need 10 samples";
    case "target-met":
      return "≤2.5 s target met";
    case "release-floor":
      return "2.5–3.0 s release floor";
    case "fail":
      return ">3.0 s — redesign";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

export function ShoppingTimingQaPanel({
  session,
  onChecklistChange,
  onDeviceLabelChange,
  onCompactDeviceLabelChange,
  onInputMethodLabelChange,
  onPhysicalContextChange,
  onSpotCheckChange,
  onNotesChange,
  onResetSamples,
}: ShoppingTimingQaPanelProps) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [resetArmed, setResetArmed] = useState(false);

  const gate = useMemo(
    () => summarizeQaEmpiricalGate(session),
    [session],
  );
  const summary479 = gate.eur479;
  const summary1250 = gate.eur1250;

  useEffect(() => {
    document.title = "Budget Cart — Empirical Timing QA";

    const robots =
      document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
      document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";

    if (!robots.isConnected) {
      document.head.append(robots);
    }

    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );

    if (description !== null) {
      description.content =
        "Internal Budget Cart empirical timing and one-hand usability QA.";
    }
  }, []);

  const targetProgress =
    Math.min(summary479.count, QA_TARGET_SAMPLE_COUNT) +
    Math.min(summary1250.count, QA_TARGET_SAMPLE_COUNT);

  const nextStep =
    gate.secondarySpotCheckFailures > 0
      ? "A secondary spot-check failed; resolve it before release."
      : summary479.count < QA_TARGET_SAMPLE_COUNT
        ? `Next: €4.79 sample ${summary479.count + 1}/${QA_TARGET_SAMPLE_COUNT}`
        : summary1250.count < QA_TARGET_SAMPLE_COUNT
        ? `Next: €12.50 sample ${summary1250.count + 1}/${QA_TARGET_SAMPLE_COUNT}`
        : !gate.deviceLabelPresent
          ? "Add the primary device/browser label."
          : !gate.compactDeviceLabelPresent
            ? "Record the compact phone / equivalent spot-check label."
            : !gate.inputMethodPresent
              ? "Record the input method used for the comparable timing samples."
              : !gate.phonePortraitViewport
                ? "Run the timing set in a representative phone-like portrait viewport."
                : !gate.lightAppearanceRecorded
                  ? "Switch to system light appearance and reopen the QA build."
                  : !gate.physicalContextComplete
                    ? "Confirm the one-handed, bright-store and default-text primary context."
                    : !gate.checklistComplete
                      ? "Complete every empirical checklist item."
                      : gate.status === "target-met"
                        ? "Empirical target met."
                          : gate.status === "release-floor"
                            ? "Release floor met; speed target still missed."
                            : gate.status === "fail"
                              ? "Gate failed; redesign before production switch."
                              : "Review evidence before release.";
  const copyResults = async (): Promise<void> => {
    const report = {
      generatedAt: new Date().toISOString(),
      environment: session.environment,
      deviceLabel: session.deviceLabel,
      compactDeviceLabel: session.compactDeviceLabel,
      inputMethodLabel: session.inputMethodLabel,
      physicalContext: session.physicalContext,
      spotChecks: session.spotChecks,
      notes: session.notes,
      checklist: session.checklist,
      gate,
      summaries: {
        eur479: summary479,
        eur1250: summary1250,
      },
      samples: session.samples,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed — use browser devtools/session storage");
    }
  };

  return (
    <aside className={styles.qaRoot} aria-label="Empirical timing QA">
      <button
        type="button"
        className={styles.qaToggle}
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        QA {targetProgress}/{QA_TARGET_SAMPLE_COUNT * 2}
      </button>

      {open ? (
        <div className={styles.panel}>
          <header className={styles.header}>
            <div>
              <p>Internal QA</p>
              <h2>Human timing gate</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
              }}
            >
              Close
            </button>
          </header>

          <p className={styles.warning}>
            This panel is not part of the product UI. Measure one-handed on a
            real phone using the documented €500 budget with no safety buffer.
            Only matching fixture samples count. Automation cannot prove the
            ≤2.5 s KPI.
          </p>

          <section
            className={styles.gateBanner}
            data-status={gate.status}
            aria-live="polite"
          >
            <strong>
              {gate.status === "target-met"
                ? "Empirical gate: target met"
                : gate.status === "release-floor"
                  ? "Empirical gate: release floor only"
                  : gate.status === "fail"
                    ? "Empirical gate: failed"
                    : "Empirical gate: not ready"}
            </strong>
            <span>{nextStep}</span>
            <small>
              Checklist {gate.checklistComplete ? "complete" : "incomplete"} ·
              Primary device {gate.deviceLabelPresent ? "set" : "missing"} ·
              Compact check {gate.compactDeviceLabelPresent ? "set" : "missing"} ·
              Input method {gate.inputMethodPresent ? "set" : "missing"} ·
              Physical context {gate.physicalContextComplete ? "complete" : "incomplete"} ·
              Phone portrait {gate.phonePortraitViewport ? "yes" : "no"} ·
              Light appearance {gate.lightAppearanceRecorded ? "yes" : "no"} ·
              Secondary checks {gate.secondarySpotChecksRecorded}/3
              {gate.secondarySpotCheckFailures > 0
                ? ` · ${gate.secondarySpotCheckFailures} failed`
                : ""}
              {gate.ignoredSampleCount > 0
                ? ` · ${gate.ignoredSampleCount} excluded sample(s)`
                : ""}
            </small>
          </section>

          <div className={styles.summaryGrid}>
            <TimingCard label="€4.79" summary={summary479} />
            <TimingCard label="€12.50" summary={summary1250} />
          </div>

          <label className={styles.field}>
            <span>Primary timing device / browser</span>
            <input
              value={session.deviceLabel}
              placeholder="Pixel 8 · Chrome"
              onChange={(event) => {
                onDeviceLabelChange(event.currentTarget.value);
              }}
            />
          </label>

          <label className={styles.field}>
            <span>Compact phone / equivalent spot-check</span>
            <input
              value={session.compactDeviceLabel}
              placeholder="iPhone SE · Safari / 360×800 equivalent"
              onChange={(event) => {
                onCompactDeviceLabelChange(event.currentTarget.value);
              }}
            />
          </label>

          <label className={styles.field}>
            <span>Comparable timing input method</span>
            <input
              value={session.inputMethodLabel}
              placeholder="On-screen custom keypad · one thumb"
              onChange={(event) => {
                onInputMethodLabelChange(event.currentTarget.value);
              }}
            />
          </label>

          <fieldset className={styles.checklist}>
            <legend>Primary physical context</legend>
            {PHYSICAL_CONTEXT.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={session.physicalContext[item.key]}
                  onChange={(event) => {
                    onPhysicalContextChange(
                      item.key,
                      event.currentTarget.checked,
                    );
                  }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className={styles.spotChecks}>
            <legend>Secondary physical spot-checks</legend>
            <p>
              These are recommended where available. A recorded failure blocks
              release; not-run does not replace the automated checks.
            </p>
            {SPOT_CHECKS.map((item) => (
              <label key={item.key}>
                <span>{item.label}</span>
                <select
                  value={session.spotChecks[item.key]}
                  onChange={(event) => {
                    onSpotCheckChange(
                      item.key,
                      event.currentTarget.value as QaSpotCheckStatus,
                    );
                  }}
                >
                  <option value="not-run">Not run</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                </select>
              </label>
            ))}
          </fieldset>

          <dl className={styles.environment}>
            <div>
              <dt>Viewport</dt>
              <dd>
                {session.environment.viewportWidth} ×{" "}
                {session.environment.viewportHeight}
              </dd>
            </div>
            <div>
              <dt>Screen</dt>
              <dd>
                {session.environment.screenWidth} ×{" "}
                {session.environment.screenHeight}
              </dd>
            </div>
            <div>
              <dt>DPR</dt>
              <dd>{session.environment.devicePixelRatio}</dd>
            </div>
            <div>
              <dt>Appearance</dt>
              <dd>{session.environment.colorScheme}</dd>
            </div>
            <div>
              <dt>Timing fixture</dt>
              <dd>€500 · no buffer</dd>
            </div>
          </dl>

          <fieldset className={styles.checklist}>
            <legend>One-hand / bright-store checklist</legend>
            {CHECKLIST.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={session.checklist[item.key]}
                  onChange={(event) => {
                    onChecklistChange(item.key, event.currentTarget.checked);
                  }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>

          <label className={styles.field}>
            <span>Notes / interruptions / typo test</span>
            <textarea
              rows={4}
              value={session.notes}
              onChange={(event) => {
                onNotesChange(event.currentTarget.value);
              }}
            />
          </label>

          <div className={styles.actions}>
            <button type="button" onClick={() => void copyResults()}>
              Copy JSON results
            </button>
            <button
              type="button"
              data-danger={resetArmed}
              onClick={() => {
                if (resetArmed) {
                  onResetSamples();
                  setResetArmed(false);
                  setCopyStatus("Timing samples reset");
                  return;
                }

                setResetArmed(true);
                setCopyStatus("Press Confirm reset to delete timing samples");
              }}
            >
              {resetArmed ? "Confirm reset" : "Reset timing samples"}
            </button>
          </div>

          {copyStatus ? (
            <p className={styles.copyStatus} role="status">
              {copyStatus}
            </p>
          ) : null}

          <details className={styles.details}>
            <summary>Environment details</summary>
            <pre>{session.environment.userAgent}</pre>
          </details>
        </div>
      ) : null}
    </aside>
  );
}

interface TimingCardProps {
  readonly label: string;
  readonly summary: ReturnType<typeof summarizeQaTimingSamples>;
}

function TimingCard({ label, summary }: TimingCardProps) {
  return (
    <section className={styles.card} data-status={summary.status}>
      <div>
        <strong>{label}</strong>
        <span>
          {summary.count}/{QA_TARGET_SAMPLE_COUNT}
        </span>
      </div>
      <dl>
        <div>
          <dt>Median</dt>
          <dd>{seconds(summary.medianMs)}</dd>
        </div>
        <div>
          <dt>P75</dt>
          <dd>{seconds(summary.p75Ms)}</dd>
        </div>
        <div>
          <dt>Max</dt>
          <dd>{seconds(summary.maxMs)}</dd>
        </div>
      </dl>
      <p>{statusLabel(summary.status)}</p>
    </section>
  );
}
