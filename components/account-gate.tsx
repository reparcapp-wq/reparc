"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, Download, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { BrandLockup, RepArcLoader } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrainingApp } from "@/components/training-app";
import { TurnstileChallenge } from "@/components/turnstile-challenge";
import { deleteAccount, loadAccount, requestSignInEmail, signOutAccount, verifySignInCode, type Account } from "@/lib/account-client";
import { reportDiagnostic } from "@/lib/diagnostics";
import { clearAccountDeviceData } from "@/lib/training-storage";
import { usePwa } from "@/hooks/use-pwa";

function AuthScreen({ onAuthenticated, installAvailable, installing, onInstall }: {
  onAuthenticated: (account: Account) => void;
  installAvailable: boolean;
  installing: boolean;
  onInstall: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const requestCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (!navigator.onLine) {
      setMessage("Connect to the internet to sign in. Existing device data remains safe.");
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setMessage("Complete the bot protection check.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await requestSignInEmail(normalized, website, captchaToken);
      setEmail(normalized);
      setSent(true);
      setMessage("Enter the one-time code from your email.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The email could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setBusy(true);
    setMessage("");
    try {
      onAuthenticated(await verifySignInCode(email, code));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The code could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <main id="main-content" className="onboarding-shell min-h-dvh bg-[#0b0d0c] text-stone-100">
      <section className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-between px-5 py-6 sm:px-10 sm:py-10">
        <header className="motion-header flex items-center justify-between"><BrandLockup /><span className="eyebrow">Secure account</span></header>
        <div className="grid gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
          <div className="motion-page">
            <p className="eyebrow text-amber-300">Your work. Your account.</p>
            <h1 className="mt-5 max-w-xl text-[clamp(3.1rem,8vw,7rem)] font-semibold leading-[0.86] tracking-[-0.07em]">Train offline.<br />Sync <span className="text-amber-300">securely.</span></h1>
            <div className="mt-7 flex max-w-lg items-start gap-3 text-sm leading-6 text-stone-400"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-300" /><p>Your cloud history is isolated to your verified account. No password is required.</p></div>
          </div>
          <div className="motion-panel rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 sm:p-7">
            <div className="grid size-11 place-items-center rounded-xl bg-amber-300 text-[#0b0d0c]"><Mail className="size-5" /></div>
            <h2 className="mt-7 text-2xl font-semibold">{sent ? "Enter your email code" : "Sign in by email"}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-400">{sent ? `Enter the 6–8 digit one-time code sent to ${email}. The code confirms new accounts and signs returning users in.` : "We will email you a one-time code. New email addresses create an account automatically, and entering the code confirms the address."}</p>
            {!sent ? (
              <>
                <label className="mt-7 block" htmlFor="account-email"><span className="eyebrow">Email address</span></label>
                <Input id="account-email" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void requestCode()} placeholder="you@example.com" aria-describedby="auth-message" className="mt-3 h-14 rounded-xl border-white/10 bg-white/[0.055] px-4 text-base text-white" />
                <label className="sr-only" htmlFor="account-website" aria-hidden="true">Website</label><input id="account-website" name="website" tabIndex={-1} aria-hidden="true" autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} className="hidden" />
                {turnstileSiteKey && <TurnstileChallenge siteKey={turnstileSiteKey} onTokenChange={setCaptchaToken} />}
                <Button type="button" onClick={() => void requestCode()} disabled={busy || Boolean(turnstileSiteKey && !captchaToken)} className="mt-5 h-14 w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{busy ? <RefreshCw className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}{busy ? "Sending…" : "Email my code"}</Button>
              </>
            ) : (
              <>
                <label className="mt-7 block" htmlFor="account-code"><span className="eyebrow">One-time code</span></label>
                <Input id="account-code" inputMode="numeric" pattern="[0-9]*" maxLength={8} autoComplete="one-time-code" autoFocus value={code} onChange={(event) => /^\d{0,8}$/.test(event.target.value) && setCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void verifyCode()} placeholder="6–8 digits" aria-describedby="auth-message" className="mt-3 h-14 rounded-xl border-white/10 bg-white/[0.055] px-4 text-center font-mono text-2xl tracking-[0.25em] text-white placeholder:font-sans placeholder:text-sm placeholder:tracking-normal" />
                <Button type="button" onClick={() => void verifyCode()} disabled={busy || code.length < 6} className="mt-5 h-14 w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{busy ? "Verifying…" : "Verify code"}</Button>
                <div className="mt-3 flex flex-wrap justify-between gap-2"><Button type="button" variant="ghost" onClick={() => { setSent(false); setCode(""); setMessage(""); }} className="min-h-11 text-xs text-stone-400">Use another email</Button><Button type="button" variant="ghost" onClick={() => void requestCode()} disabled={busy} className="min-h-11 text-xs text-amber-300">Send again</Button></div>
              </>
            )}
            <p id="auth-message" className={`mt-4 min-h-5 text-xs ${message ? "motion-notice" : ""} ${message.toLowerCase().includes("one-time code") ? "text-emerald-300" : "text-amber-300"}`} role="status" aria-live="polite">{message}</p>
            {installAvailable && <Button type="button" variant="outline" onClick={() => void onInstall()} disabled={installing} className="mt-3 min-h-11 w-full rounded-xl border-white/10 bg-white/[0.03] text-stone-300"><Download className="size-4" />{installing ? "Opening installer…" : "Install this app"}</Button>}
          </div>
        </div>
        <div className="max-w-lg text-xs leading-5 text-stone-500"><p>After the first secure sign-in, this device can still open and record workouts without internet. Authentication tokens are stored in protected cookies, never in the workout database.</p><p className="mt-3"><a href="/privacy" className="underline decoration-white/20 underline-offset-4 hover:text-stone-300">Privacy</a><span aria-hidden="true"> · </span><a href="/terms" className="underline decoration-white/20 underline-offset-4 hover:text-stone-300">Terms & safety</a></p></div>
      </section>
      </main>
    </>
  );
}

export function AccountGate() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const pwa = usePwa();
  const refreshAccount = useCallback(async () => setAccount((await loadAccount()).account), []);

  useEffect(() => {
    void loadAccount().then((loaded) => setAccount(loaded.account));
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth")) {
      url.searchParams.delete("auth");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [refreshAccount]);

  useEffect(() => {
    const revalidate = () => void refreshAccount();
    window.addEventListener("my-progress-auth-required", revalidate);
    return () => window.removeEventListener("my-progress-auth-required", revalidate);
  }, [refreshAccount]);

  useEffect(() => {
    if (!account) return;
    const runtimeError = (event: ErrorEvent) => reportDiagnostic(account.id, "runtime", event.error ?? event.message);
    const promiseError = (event: PromiseRejectionEvent) => reportDiagnostic(account.id, "promise", event.reason);
    window.addEventListener("error", runtimeError);
    window.addEventListener("unhandledrejection", promiseError);
    return () => {
      window.removeEventListener("error", runtimeError);
      window.removeEventListener("unhandledrejection", promiseError);
    };
  }, [account]);

  const signOut = async () => {
    if (!navigator.onLine) throw new Error("Reconnect before signing out so the protected session can be closed safely.");
    await signOutAccount();
    setAccount(null);
  };

  const deleteCurrentAccount = async () => {
    if (!account) return;
    if (!navigator.onLine) throw new Error("Reconnect before deleting your account so cloud data can be erased safely.");
    const accountId = account.id;
    await deleteAccount();
    await clearAccountDeviceData(accountId);
    setAccount(null);
  };

  if (account === undefined) return <main id="main-content" className="grid min-h-dvh place-items-center bg-[#0b0d0c] text-stone-100"><RepArcLoader label="Opening secure account" /></main>;
  if (!account) return <AuthScreen onAuthenticated={setAccount} installAvailable={pwa.installAvailable} installing={pwa.installing} onInstall={pwa.install} />;

  return (
    <AppErrorBoundary accountId={account.id}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <TrainingApp account={account} onSignOut={signOut} onDeleteAccount={deleteCurrentAccount} pwa={pwa} />
      {pwa.updateAvailable && <aside className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-amber-300/30 bg-[#171a17] p-4 shadow-2xl" aria-label="App update available" role="status"><div><p className="text-sm font-semibold">App update ready</p><p className="mt-1 text-xs text-stone-400">No sign-out needed. Update when you are between sets.</p></div><Button type="button" onClick={pwa.applyUpdate} className="min-h-11 shrink-0 rounded-xl bg-amber-300 font-bold text-[#0b0d0c]">Update now</Button></aside>}
    </AppErrorBoundary>
  );
}
