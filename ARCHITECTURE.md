# Architecture

## Goal

Pulse Counter treats a tiny UI as an exercise in proportional software design.

The main constraint is deliberate: preserve the simplicity of a counter while making behavior testable, persistence resilient, and presentation replaceable.

## Boundaries

### `counter-model.js`

Owns the domain rules:

- supported range
- supported step sizes
- increment/decrement/reset transitions
- clamping
- transition metadata used by presentation feedback

It is a pure module with no React or browser dependencies, which makes it cheap to test and reuse.

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
- maps global keyboard shortcuts to domain actions
- ignores editable controls so shortcuts do not interfere with text input if the UI grows later

### `CounterExperience.jsx`

Owns composition and accessible interaction semantics. It does not implement counter rules directly.

### `ParticleBurst.jsx`

Owns one bounded visual effect. Particle positions are deterministic; there is no random render output and no continuous animation loop.

## Visual engineering

The visual layer favors CSS over JavaScript:

- pointer coordinates are written to CSS custom properties instead of React state, avoiding render churn
- CSS `@property` animates the orbit gradient
- particles are finite DOM nodes that disappear after one CSS animation
- `prefers-reduced-motion` collapses motion globally
- touch devices disable the pointer-tilt transform

This keeps the effect budget predictable and avoids an animation dependency for a component that does not need one.

## State model

```text
idle
  ├─ increment → up
  ├─ decrement → down
  ├─ reset     → reset
  ├─ set-step  → step
  └─ invalid boundary transition → blocked
```

`revision` is presentation metadata used to restart bounded feedback effects. The count remains the single source of truth.

## Trade-offs

### Why no TypeScript migration?

The original repository is a JavaScript/Vite project. The domain is deliberately tiny, and adding a TypeScript migration only to make the stack look larger would create churn without meaningful risk reduction. The pure model and automated tests provide the higher-value safety here.

### Why no animation library?

The interface needs a few deterministic micro-interactions, not a general animation runtime. Native CSS is smaller, easier to audit, and sufficient.

### Why local storage instead of a backend?

The state is single-user, device-local, non-sensitive, and has no collaboration requirement. A backend would add operational cost without product value.
