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
- capability-detects the native typed View Transition API instead of branching on browser identity
- starts pointer-driven transitions with `document.startViewTransition({ update, types })`
- commits the reducer synchronously inside the native snapshot callback with React DOM `flushSync`
- skips an in-flight visual transition before starting a newer one, keeping rapid interaction responsive
- uses a short commit watchdog: if an engine starts a transition but does not invoke its update callback promptly, the visual transition is skipped and the reducer commits exactly once
- keeps keyboard updates immediate, so input semantics never depend on animation
- bypasses visual transitions when `prefers-reduced-motion` is enabled
- synchronizes the tiny local snapshot in a layout effect so the visible value is persistence-safe before paint
- keeps motion orchestration out of the domain model

A failed, skipped, stalled, or unsupported visual transition never changes the domain path: `commitOnce` guarantees one reducer commit and reducer state remains authoritative.

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

The component maps state to presentation but does not implement counter rules or persistence. The numeric value and step readout opt into narrowly scoped native snapshots through CSS `view-transition-name`, so the browser never needs to snapshot the entire interface.

### `ParticleBurst.jsx`

Owns one bounded visual effect. Particle positions are deterministic; there is no random render output and no permanent JavaScript animation loop.

## Visual engineering

The visual layer favors native platform primitives:

- native typed View Transitions for directional numeric state changes
- CSS `@property` for typed, animatable custom properties
- OKLCH tokens for perceptually consistent spectral color
- container queries for component-level responsiveness
- CSS masks and conic/radial gradients for the orbital visual system
- `backdrop-filter` for the glass surface
- CSS custom properties for pointer-reactive lighting
- GPU-friendly transforms instead of layout animation
- `prefers-reduced-motion` and `prefers-contrast` fallbacks

Modern features are progressive enhancement. Typed View Transitions are capability-gated at the application adapter boundary with feature detection, not user-agent sniffing. Reduced-motion and keyboard interactions bypass animation entirely. Counter behavior, persistence and accessible controls never depend on the decorative layer.

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
pointer action
      ↓
capability + reduced-motion gate
      ├─ fallback → reducer
      │
      └─ document.startViewTransition({ types })
                    ↓
                 flushSync
                    ↓
                 reducer
                    ↓
          named CSS snapshots
                    ↓
      :active-view-transition-type(...)
```

Directional motion comes from the action type, while state correctness remains independent from animation.

## Trade-offs

### Why no TypeScript migration?

The original repository is a JavaScript/Vite project. The domain is tiny, the boundaries are narrow, and runtime behavior is heavily covered. A TypeScript migration would add churn without enough additional risk reduction for this codebase.

### Why no animation library?

The native View Transition API and modern CSS cover the exact interaction requirements. A general animation runtime would add bundle weight and an additional abstraction layer without product value.

### Why not WebGL or Three.js?

The interface needs depth and spectacle, but not a 3D scene graph. CSS gradients, masks, filters and transforms can deliver the visual language while keeping startup cost, bundle size and maintenance low.

### Why local storage instead of a backend?

The state is single-user, device-local, non-sensitive, and has no collaboration requirement. A backend would add operational cost without product value.
