# Architecture

## Goal

Pulse Counter treats a tiny UI as an exercise in proportional software design.

The constraint is deliberate: preserve the simplicity of a counter while making behavior testable, persistence resilient, rendering replaceable, and visual polish substantial enough to demonstrate interaction engineering.

## Boundaries

### `counter-model.js`

Owns the domain rules:

- supported range
- supported step sizes
- increment/decrement/reset transitions
- clamping
- transition metadata used by presentation feedback

It is a pure module with no React or browser dependencies.

### `counter-storage.js`

Owns persistence concerns:

- versioned snapshot format
- malformed-data recovery
- migration from the original project's plain `counter` local-storage entry
- safe failure when storage is unavailable

Persistence failure never prevents the counter from operating in memory.

### `useCounter.js`

Acts as the application adapter:

- connects the pure reducer to React
- persists stable state
- scopes arrow-key shortcuts to the focused counter region
- uses React 19.3 transitions to annotate pointer-driven increment/decrement/reset/step updates when the native integration is verified reliable
- keeps keyboard updates immediate, so input semantics never depend on animation
- falls back to immediate reducer dispatch when View Transitions are unavailable, reduced motion is requested, or the current WebKit interop path is detected
- synchronizes the tiny local snapshot in a layout effect so the visible value is persistence-safe before paint
- keeps motion orchestration out of the domain model

`addTransitionType` gives the presentation layer the cause of a state transition without teaching the reducer about React View Transitions.

### `usePointerSurface.js`

Owns high-frequency pointer rendering:

- keeps pointer coordinates out of React state
- coalesces updates through `requestAnimationFrame`
- writes only CSS custom properties
- cancels pending animation frames during cleanup
- resets surface transforms on pointer leave

This is an imperative rendering adapter around a declarative React UI.

### `CounterExperience.jsx`

Owns composition and accessible interaction semantics.

The component maps state to presentation but does not implement counter rules or persistence. React `<ViewTransition>` boundaries are intentionally narrow: the numeric value and step readout animate without snapshotting the entire interface.

### `ParticleBurst.jsx`

Owns one bounded visual effect. Particle positions are deterministic; there is no random render output and no permanent JavaScript animation loop.

## Visual engineering

The visual layer favors native platform primitives:

- React 19.3 View Transitions for directional numeric state changes
- CSS `@property` for typed, animatable custom properties
- OKLCH tokens for perceptually consistent spectral color
- container queries for component-level responsiveness
- CSS masks and conic/radial gradients for the orbital visual system
- `backdrop-filter` for the glass surface
- CSS custom properties for pointer-reactive lighting
- GPU-friendly transforms instead of layout animation
- `prefers-reduced-motion` and `prefers-contrast` fallbacks

Modern features are progressive enhancement. View Transitions are capability-gated at the application adapter boundary; reduced-motion and keyboard interactions bypass them entirely. WebKit 26.6 currently exposes the API but does not complete the React 19.3 transition reliably in this interaction, so that engine uses the same UI with immediate commits behind one isolated compatibility guard. Counter behavior, persistence and accessible controls never depend on the decorative layer.

## State model

```text
idle
  ├─ increment → up
  ├─ decrement → down
  ├─ reset     → reset
  ├─ set-step  → step
  └─ invalid boundary transition → blocked
```

`revision` is presentation metadata used to restart bounded particle feedback. The count remains the single source of truth.

## Transition flow

```text
pointer action ── verified native VT ─→ startTransition + addTransitionType
      │                                      ↓
      │                                  pure reducer
      │                                      ↓
      │                              React ViewTransition
      │                                      ↓
      │                              CSS transition class
      │
      └─ fallback / keyboard / reduced motion ─→ pure reducer
```

Directional motion is therefore derived from the user action rather than inferred from DOM measurements.

## Trade-offs

### Why no TypeScript migration?

The original repository is a JavaScript/Vite project. The domain is tiny, the boundaries are narrow, and runtime behavior is heavily covered. A TypeScript migration would add churn without enough additional risk reduction for this codebase.

### Why no animation library?

React 19.3 and modern CSS now cover the exact interaction requirements. A general animation runtime would add bundle weight and an additional abstraction layer without product value.

### Why not WebGL or Three.js?

The interface needs depth and spectacle, but not a 3D scene graph. CSS gradients, masks, filters and transforms can deliver the visual language while keeping startup cost, bundle size and maintenance low.

### Why local storage instead of a backend?

The state is single-user, device-local, non-sensitive, and has no collaboration requirement. A backend would add operational cost without product value.
