export function contentSecurityPolicy(nonce: string, development = false) {
  if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return ["default-src 'self'", "base-uri 'self'", `connect-src 'self' https://challenges.cloudflare.com${development ? " ws: wss:" : ""}`,
    "font-src 'self' data:", "form-action 'self'", "frame-src https://challenges.cloudflare.com", "frame-ancestors 'none'",
    "img-src 'self' data: blob:", "manifest-src 'self'", "media-src 'self'", "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // React/Radix charts, sheets and user-selected progress values use style attributes.
    // Script execution is nonce protected; style attributes remain explicitly allowed.
    "style-src 'self' 'unsafe-inline'", "worker-src 'self' blob:",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
