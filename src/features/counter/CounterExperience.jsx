import { ViewTransition, useState } from "react";
import "../../App.css";
import { MAX_COUNT, MIN_COUNT, STEP_OPTIONS } from "./counter-model.js";
import { ParticleBurst } from "./ParticleBurst.jsx";
import { useCounter } from "./useCounter.js";
import { usePointerSurface } from "./usePointerSurface.js";

const numberFormatter = new Intl.NumberFormat("en-US");

const formatSigned = (value) => {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
};

export function CounterExperience() {
  const {
    state,
    increment,
    decrement,
    reset,
    setStep,
    handleKeyboardAction,
  } = useCounter();
  const [sessionStart] = useState(() => state.value);
  const { surfaceRef, handlePointerMove, handlePointerLeave } = usePointerSurface();

  const sessionDelta = state.value - sessionStart;
  const stepIndex = STEP_OPTIONS.indexOf(state.step);
  const energy = Math.min(state.value / 25, 1);

  return (
    <main className="experience-shell">
      <div className="spectral-field" aria-hidden="true" />
      <div className="aurora aurora--one" aria-hidden="true" />
      <div className="aurora aurora--two" aria-hidden="true" />
      <div className="aurora aurora--three" aria-hidden="true" />
      <div className="grid-glow" aria-hidden="true" />

      <section
        ref={surfaceRef}
        className="counter-surface"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        aria-labelledby="counter-title"
        style={{ "--energy": energy }}
      >
        <div className="surface-light" aria-hidden="true" />
        <div className="surface-spectrum" aria-hidden="true" />

        <header className="surface-header">
          <div className="title-cluster">
            <div className="eyebrow-row">
              <p className="eyebrow">
                <span className="status-dot" />
                Interaction lab
              </p>
              <span className="tech-pill">React 19.3 · Native VT</span>
            </div>

            <h1 id="counter-title">Pulse Counter</h1>
            <p className="lede">
              A tactile counter shaped with native view transitions, spectral
              color, spatial depth and motion that respects the user.
            </p>
          </div>

          <a
            className="source-link"
            href="https://github.com/MykolaDotsenko/React-counter"
            target="_blank"
            rel="noreferrer"
          >
            <span>Source</span>
            <span className="source-link__icon" aria-hidden="true">↗</span>
          </a>
        </header>

        <div className="counter-layout">
          <section
            className="counter-stage"
            aria-label="Counter controls"
            aria-describedby="keyboard-instructions"
            aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft"
            tabIndex={0}
            onKeyDown={handleKeyboardAction}
          >
            <div className="stage-chrome" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>

            <div className="counter-orbit">
              <div className="orbit-aura" aria-hidden="true" />
              <div className="orbit-track orbit-track--outer" aria-hidden="true" />
              <div className="orbit-track orbit-track--inner" aria-hidden="true" />
              <span className="orbit-node orbit-node--one" aria-hidden="true" />
              <span className="orbit-node orbit-node--two" aria-hidden="true" />
              <span className="orbit-node orbit-node--three" aria-hidden="true" />
              <ParticleBurst revision={state.revision} motion={state.motion} />

              <div className="counter-core">
                <div className="core-sheen" aria-hidden="true" />
                <span className="counter-label">Current value</span>

                <ViewTransition
                  default="none"
                  update={{
                    increment: "count-up",
                    decrement: "count-down",
                    reset: "count-reset",
                    default: "count-change",
                  }}
                >
                  <output
                    className="counter-value"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label={`Current count ${state.value}`}
                  >
                    {numberFormatter.format(state.value)}
                  </output>
                </ViewTransition>

                <span
                  className="delta-chip"
                  data-tone={
                    state.lastDelta > 0
                      ? "up"
                      : state.lastDelta < 0
                        ? "down"
                        : "neutral"
                  }
                >
                  <span className="delta-chip__spark" aria-hidden="true" />
                  {formatSigned(state.lastDelta)}
                </span>
              </div>
            </div>

            <div className="primary-controls">
              <button
                className="control-button control-button--decrease"
                type="button"
                onClick={decrement}
                disabled={state.value <= MIN_COUNT}
                aria-label={`Decrease by ${state.step}`}
              >
                <span className="control-glow" aria-hidden="true" />
                <span className="control-symbol" aria-hidden="true">−</span>
                <span className="control-copy">
                  <strong>Decrease</strong>
                  <small>by {state.step}</small>
                </span>
                <kbd aria-hidden="true">↓</kbd>
              </button>

              <button
                className="control-button control-button--increase"
                type="button"
                onClick={increment}
                disabled={state.value >= MAX_COUNT}
                aria-label={`Increase by ${state.step}`}
              >
                <span className="control-glow" aria-hidden="true" />
                <span className="control-symbol" aria-hidden="true">+</span>
                <span className="control-copy">
                  <strong>Increase</strong>
                  <small>by {state.step}</small>
                </span>
                <kbd aria-hidden="true">↑</kbd>
              </button>
            </div>
          </section>

          <aside
            className="control-panel"
            aria-label="Counter settings and session information"
          >
            <div className="panel-block panel-block--pace">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Step size</span>
                  <h2>Choose your pace</h2>
                </div>

                <ViewTransition
                  default="none"
                  update={{ step: "step-shift", default: "none" }}
                >
                  <span className="step-readout" aria-hidden="true">
                    ×{state.step}
                  </span>
                </ViewTransition>
              </div>

              <div
                className="step-selector"
                aria-label="Choose counter step"
                style={{ "--step-index": stepIndex }}
              >
                <span className="step-selector__active" aria-hidden="true" />
                {STEP_OPTIONS.map((stepOption) => (
                  <button
                    key={stepOption}
                    type="button"
                    className="step-option"
                    aria-label={`Set step to ${stepOption}`}
                    aria-pressed={state.step === stepOption}
                    onClick={() => setStep(stepOption)}
                  >
                    {stepOption}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-block panel-block--stats">
              <div className="metric">
                <span>Session delta</span>
                <strong>{formatSigned(sessionDelta)}</strong>
              </div>
              <div className="metric">
                <span>Persistence</span>
                <strong>Local</strong>
              </div>
              <div className="metric">
                <span>Range</span>
                <strong>0–999K</strong>
              </div>
            </div>

            <button
              type="button"
              className="reset-button"
              onClick={reset}
              disabled={state.value === MIN_COUNT}
            >
              <span className="reset-button__icon" aria-hidden="true">↺</span>
              <span>Reset to zero</span>
              <span className="reset-button__hint" aria-hidden="true">Fresh start</span>
            </button>

            <p className="keyboard-note" id="keyboard-instructions">
              <span className="keyboard-note__icon" aria-hidden="true">⌨</span>
              Focus the counter panel, then use the arrow keys to change the value.
            </p>
          </aside>
        </div>

        <footer className="surface-footer">
          <span><i aria-hidden="true" /> React View Transitions</span>
          <span><i aria-hidden="true" /> OKLCH spectral color</span>
          <span><i aria-hidden="true" /> Reduced-motion aware</span>
        </footer>
      </section>
    </main>
  );
}
