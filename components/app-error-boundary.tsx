"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportDiagnostic } from "@/lib/diagnostics";

export class AppErrorBoundary extends Component<{
  accountId?: string;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.props.accountId) reportDiagnostic(this.props.accountId, "render", error, { view: info.componentStack ? "component" : "unknown" });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main id="main-content" className="grid min-h-dvh place-items-center bg-[#0b0d0c] px-5 text-stone-100">
        <section className="w-full max-w-md rounded-[1.5rem] border border-white/10 bg-[#121512] p-6 text-center">
          <p className="eyebrow text-red-300">Something went wrong</p>
          <h1 className="mt-3 text-2xl font-semibold">Your saved workouts are still safe.</h1>
          <p className="mt-3 text-sm leading-6 text-stone-400">Reload the app to recover. Offline changes already written to this device will remain queued.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-11 rounded-xl bg-amber-300 px-5 font-bold text-[#0b0d0c]">Reload app</button>
        </section>
      </main>
    );
  }
}
