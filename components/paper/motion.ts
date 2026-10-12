"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the shaders may move (Verowater's components/sections/motion.ts).
 *
 * Two things stop them: the visitor's system setting (prefers-reduced-motion), and
 * the visitor's own pause from any pause button. One press stops every moving
 * surface on the site and is remembered. WCAG 2.2.2 asks that motion which starts by
 * itself and runs for more than five seconds can be paused by the visitor, and most
 * people never find the operating-system switch.
 */
export type Motion = "moving" | "paused" | "reduced";

const REDUCED = "(prefers-reduced-motion: reduce)";
const KEY = "qw-motion";
const listeners = new Set<() => void>();
let paused: boolean | null = null;

function readStoredPause(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  // A pause pressed in another tab applies here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    paused = readStoredPause();
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    mq.removeEventListener("change", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Motion {
  if (window.matchMedia(REDUCED).matches) return "reduced";
  if (paused === null) paused = readStoredPause();
  return paused ? "paused" : "moving";
}

export function useMotion(): Motion {
  // The server renders "moving"; nothing moves before hydration anyway, because the shaders are client-only.
  return useSyncExternalStore(subscribe, getSnapshot, () => "moving");
}

export function setMotionPaused(next: boolean) {
  paused = next;
  try {
    window.localStorage.setItem(KEY, next ? "paused" : "moving");
  } catch {
    // Storage blocked (private mode): the pause still holds for this page view.
  }
  listeners.forEach((listener) => listener());
}
