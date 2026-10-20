export type CloudSyncIssue = {
  kind: "network" | "auth" | "blocked" | "validation" | "rate-limit" | "update" | "server" | "archive" | "conflict";
  message: string;
  status?: number;
  retryAfterSeconds?: number;
};

export class CloudSyncError extends Error {
  constructor(readonly issue: CloudSyncIssue) {
    super(issue.message);
    this.name = "CloudSyncError";
  }
}

export function syncIssueFromError(error: unknown): CloudSyncIssue {
  if (error instanceof CloudSyncError) return error.issue;
  return {
    kind: "network",
    message: error instanceof Error && error.name === "AbortError"
      ? "The cloud request timed out. Tap Retry sync to try again."
      : "RepArc could not reach cloud sync. Check your connection, then retry.",
  };
}

export async function cloudResponseError(response: Response): Promise<CloudSyncError> {
  const status = response.status;
  let detail = "";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      detail = body.error.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 200);
    }
  } catch { /* A non-JSON error page is not a useful user-facing explanation. */ }
  if (status === 401) return new CloudSyncError({ kind: "auth", status, message: "Your cloud sign-in needs renewing. Sign in again without clearing this app’s storage." });
  if (status === 403) return new CloudSyncError({ kind: "blocked", status, message: "The server blocked this sync request. Retry; if it continues, report sync error 403." });
  if (status === 429) {
    const header = response.headers.get("Retry-After");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 60;
    const retryAfterSeconds = Number.isFinite(seconds) ? Math.max(1, Math.min(86_400, seconds)) : 60;
    return new CloudSyncError({ kind: "rate-limit", status, retryAfterSeconds, message: `Cloud sync is busy. Wait ${retryAfterSeconds} seconds before retrying.` });
  }
  if (status === 426) return new CloudSyncError({ kind: "update", status, message: "Update RepArc before syncing this history. Do not clear app storage." });
  if (status === 503 && detail.startsWith("Cloud revision protection needs updating.")) return new CloudSyncError({ kind: "update", status, message: "The cloud database needs an update before it can save changes. Report sync error 503." });
  if (status === 400 || status === 422) return new CloudSyncError({ kind: "validation", status, message: `The cloud could not accept this record (${status}).${detail ? ` ${detail}` : " Report this sync error so the record can be checked."}` });
  if (status === 413) return new CloudSyncError({ kind: "archive", status, message: "The cloud rejected the history size. Report sync error 413; do not delete workout records." });
  return new CloudSyncError({ kind: "server", status, message: `Cloud sync is temporarily unavailable (${status}). Retry in a moment.` });
}
