"use client";

import { APP_RELEASE, sanitizeAppContext, sanitizeDiagnosticMessage } from "@/lib/telemetry-shared";

export type DiagnosticKind = "render" | "runtime" | "promise" | "sync" | "pwa";

const consentKey = (accountId: string) => `my-progress-diagnostics-v1:${accountId}`;

export function diagnosticsEnabled(accountId: string) {
  try {
    return window.localStorage.getItem(consentKey(accountId)) === "1";
  } catch {
    return false;
  }
}

export function setDiagnosticsEnabled(accountId: string, enabled: boolean) {
  try {
    window.localStorage.setItem(consentKey(accountId), enabled ? "1" : "0");
  } catch {
    // Consent remains in component state for this visit.
  }
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : error;

export function reportDiagnostic(accountId: string, kind: DiagnosticKind, error: unknown, context: Record<string, unknown> = {}) {
  if (!diagnosticsEnabled(accountId) || !navigator.onLine) return;
  const body = JSON.stringify({
    kind,
    message: sanitizeDiagnosticMessage(errorMessage(error)),
    context: sanitizeAppContext({
      ...context,
      online: navigator.onLine,
      installed: window.matchMedia("(display-mode: standalone)").matches,
      route: window.location.pathname,
      release: APP_RELEASE,
    }),
  });
  void fetch("/api/diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export async function submitBetaFeedback(category: string, message: string, includeContext: boolean, context: Record<string, unknown>) {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, message, includeContext, context: sanitizeAppContext(context) }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Feedback could not be sent.");
}
