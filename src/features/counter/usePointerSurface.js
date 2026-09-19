import { useEffect, useRef } from "react";

const DEFAULT_SURFACE_STATE = Object.freeze({
  pointerX: "50%",
  pointerY: "35%",
  rotateX: "0deg",
  rotateY: "0deg",
});

const applySurfaceState = (surface, state) => {
  surface.style.setProperty("--pointer-x", state.pointerX);
  surface.style.setProperty("--pointer-y", state.pointerY);
  surface.style.setProperty("--rotate-x", state.rotateX);
  surface.style.setProperty("--rotate-y", state.rotateY);
};

export function usePointerSurface() {
  const surfaceRef = useRef(null);
  const frameRef = useRef(null);
  const pointerRef = useRef(null);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const flushPointer = () => {
    frameRef.current = null;
    const surface = surfaceRef.current;
    const pointer = pointerRef.current;
    if (!surface || !pointer) return;

    const bounds = surface.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;

    const x = ((pointer.x - bounds.left) / bounds.width) * 100;
    const y = ((pointer.y - bounds.top) / bounds.height) * 100;
    const clampedX = Math.min(Math.max(x, 0), 100);
    const clampedY = Math.min(Math.max(y, 0), 100);

    applySurfaceState(surface, {
      pointerX: `${clampedX}%`,
      pointerY: `${clampedY}%`,
      rotateX: `${((50 - clampedY) / 50) * 2.2}deg`,
      rotateY: `${((clampedX - 50) / 50) * 2.6}deg`,
    });
  };

  const handlePointerMove = (event) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };

    if (frameRef.current === null) {
      frameRef.current = window.requestAnimationFrame(flushPointer);
    }
  };

  const handlePointerLeave = () => {
    pointerRef.current = null;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (surfaceRef.current) {
      applySurfaceState(surfaceRef.current, DEFAULT_SURFACE_STATE);
    }
  };

  return {
    surfaceRef,
    handlePointerMove,
    handlePointerLeave,
  };
}
