"use client";

import { useSyncExternalStore } from "react";

// Whether the app is serving mock data because the backend is unreachable.
let mockMode = false;
let lastProbeAt = 0;
const listeners = new Set<() => void>();

export const MOCK_REPROBE_MS = 15_000;

export function isMockMode() {
  return mockMode;
}

export function setMockMode(value: boolean) {
  lastProbeAt = Date.now();
  if (mockMode === value) return;
  mockMode = value;
  listeners.forEach((l) => l());
}

/** In mock mode, GETs try the real backend again at most every MOCK_REPROBE_MS. */
export function shouldReprobe() {
  return Date.now() - lastProbeAt > MOCK_REPROBE_MS;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMockMode() {
  return useSyncExternalStore(subscribe, isMockMode, () => false);
}
