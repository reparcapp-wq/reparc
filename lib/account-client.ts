"use client";

export type Account = { id: string; email: string };

const ACCOUNT_KEY = "my-progress-account-v1";

export function cachedAccount(): Account | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) ?? "null") as Partial<Account> | null;
    return value?.id && typeof value.id === "string" && typeof value.email === "string"
      ? { id: value.id, email: value.email }
      : null;
  } catch {
    return null;
  }
}

export function cacheAccount(account: Account | null) {
  try {
    if (account) window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    else window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    // The authenticated cookie remains authoritative while online.
  }
}

export async function loadAccount() {
  const cached = cachedAccount();
  if (typeof navigator !== "undefined" && !navigator.onLine) return { account: cached, offline: true };
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json() as { account: Account };
      cacheAccount(payload.account);
      return { account: payload.account, offline: false };
    }
    if (response.status === 401) cacheAccount(null);
    return { account: response.status === 401 ? null : cached, offline: false };
  } catch {
    return { account: cached, offline: true };
  }
}

async function jsonRequest(path: string, body?: unknown, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; account?: Account };
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
  return payload;
}

export async function requestSignInEmail(email: string, website = "") {
  await jsonRequest("/api/auth/request", { email, website });
}

export async function verifySignInCode(email: string, token: string) {
  const payload = await jsonRequest("/api/auth/verify", { email, token });
  if (!payload.account) throw new Error("The account could not be opened.");
  cacheAccount(payload.account);
  return payload.account;
}

export async function signOutAccount() {
  await jsonRequest("/api/auth/signout");
  cacheAccount(null);
}

export async function deleteAccount() {
  await jsonRequest("/api/account", undefined, "DELETE");
  cacheAccount(null);
}
