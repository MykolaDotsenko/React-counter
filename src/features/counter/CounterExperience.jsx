import { useMemo, useRef } from "react";
import "../../App.css";
import { MAX_COUNT, MIN_COUNT, STEP_OPTIONS } from "./counter-model.js";
import { ParticleBurst } from "./ParticleBurst.jsx";
import { useCounter } from "./useCounter.js";

const numberFormatter = new Intl.NumberFormat("en-US");

const formatSigned = (value) => {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${numberFormatter.format(value)}`;
};

export function CounterExperience() {
  const { state, increment, decrement, reset, setStep } = useCounter();
  const surfaceRef = useRef(null);
  const sessionStartRef = useRef(state.value);

  const sessionDelta = state.value - sessionStartRef.current;
  const progress = useMemo(() => Math.min((state.value / 100) * 100, 100), [state.value]);

  const handlePointerMove = (event) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const bounds = surface.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    const rotateY = ((x - 50) / 50) * 2.6;
    const rotateX = ((50 - y) / 50) * 2.2;

    surface.style.setProperty("--pointer-x", `${x}%`);
    surface.style.setProperty("--pointer-y", `${y}%`);
    surface.style.setProperty("--rotate-x", `${rotateX}deg`);
    surface.style.setProperty("--rotate-y", `${rotateY}deg`);
  };

  const handlePointerLeave = () => {
    const surface = surfaceRef.current;
    if (!surface) return;

    surface.style.setProperty("--pointer-x", "50%");
    surface.style.setProperty("--pointer-y", "35%");
    surface.style.setProperty("--rotate-x", "0deg");
    surface.style.setProperty("--rotate-y", "0deg");
  };

  return (
    <main className="experience-shell">
      <div className="aurora aurora--one" aria-hidden="true" />
      <div className="aurora aurora--two" aria-hidden="true" />
      <div className="grid-glow" aria-hidden="true" />

      <section
        ref={surfaceRef}
        className="counter-surface"
        data-motion={state.motion}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        aria-labelledby="counter-title"
      >
        <div className="surface-light" aria-hidden="true" />

        <header className="surface-header">
          <div>
            <p className="eyebrow"><span className="status-dot" /> Interaction lab</p>
            <h1 id="counter-title">Pulse Counter</h1>
            <p className="lede">
              A deliberately small interface refined around motion, feedback, accessibility and restraint.
            </p>
          </div>

          <a
            className="source-link"
            href="https://github.com/MykolaDotsenko/React-counter"
            target="_blank"
            rel="noreferrer"
          >
            Source <span aria-hidden="true">↗</span>
          </a>
        </header>

        <div className="counter-layout">
          <section className="counter-stage" aria-label="Counter controls">
            <div className="counter-orbit" style={{ "--progress": `${progress}%` }}>
              <div className="orbit-track" aria-hidden="true" />
              <ParticleBurst revision={state.revision} motion={state.motion} />

              <div className="counter-core">
                <span className="counter-label">Current value</span>
                <output
                  className="counter-value"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`Current count ${state.value}`}
                >
                  <span key={`${state.value}-${state.revision}`}>{numberFormatter.format(state.value)}</span>
                </output>
                <span className="delta-chip" data-tone={state.lastDelta > 0 ? "up" : state.lastDelta < 0 ? "down" : "neutral"}>
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
                <span className="control-symbol" aria-hidden="true">+</span>
                <span className="control-copy">
                  <strong>Increase</strong>
                  <small>by {state.step}</small>
                </span>
                <kbd aria-hidden="true">↑</kbd>
              </button>
            </div>
          </section>

          <aside className="control-panel" aria-label="Counter settings and session information">
            <div className="panel-block">
              <div className="panel-heading">
                <div>
                  <span className="panel-kicker">Step size</span>
                  <h2>Choose your pace</h2>
                </div>
                <span className="step-readout">×{state.step}</span>
              </div>

              <div className="step-selector" aria-label="Choose counter step">
                {STEP_OPTIONS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    className="step-option"
                    aria-pressed={state.step === step}
                    onClick={() => setStep(step)}
                  >
                    {step}
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
              <span aria-hidden="true">↺</span>
              Reset to zero
              <kbd aria-hidden="true">R</kbd>
            </button>

            <p className="keyboard-note">
              <span aria-hidden="true">⌨</span>
              Arrow keys change the value. Home or R resets it.
            </p>
          </aside>
        </div>

        <footer className="surface-footer">
          <span><i aria-hidden="true" /> Reduced-motion aware</span>
          <span><i aria-hidden="true" /> Keyboard complete</span>
          <span><i aria-hidden="true" /> Zero runtime UI dependencies</span>
        </footer>
      </section>
    </main>
  );
}
