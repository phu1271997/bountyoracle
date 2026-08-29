// src/lib/validate.js
// URL allowlist + scheme guard for user-submitted GitHub links.
//
// The contract already checks the string starts with `https://github.com/`
// and, for PR URLs, that `/pull/` appears in the path. The frontend runs
// a stricter allowlist so bad input never even reaches a write tx:
//
//   * only https: (rejects javascript:, data:, file:, http:).
//   * hostname must be exactly github.com (rejects github.com.evil.tld
//     and raw.githubusercontent.com — different origin).
//   * no query string, no fragment — a query string in a bounty link
//     usually smuggles a session token (?installation_id, ?token, …)
//     and there is no legitimate reason a public issue/PR URL needs one.
//
// Returns { ok: true } on success, { ok: false, reason: <string> } on
// rejection. The caller shows `reason` inline near the input.

const GH = "github.com";

function _parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function validateIssueUrl(raw) {
  const u = _parse((raw || "").trim());
  if (!u) return { ok: false, reason: "Not a valid URL." };
  if (u.protocol !== "https:") {
    return { ok: false, reason: `Scheme "${u.protocol}" is not allowed. Use https://…` };
  }
  if (u.hostname !== GH) {
    return { ok: false, reason: `Host must be exactly github.com (got "${u.hostname}").` };
  }
  if (u.search || u.hash) {
    return { ok: false, reason: "Remove any ?query or #fragment from the URL." };
  }
  if (!/^\/[^/]+\/[^/]+\/issues\/\d+\/?$/.test(u.pathname)) {
    return { ok: false, reason: "Expected /owner/repo/issues/<number>." };
  }
  return { ok: true };
}

export function validatePrUrl(raw) {
  const u = _parse((raw || "").trim());
  if (!u) return { ok: false, reason: "Not a valid URL." };
  if (u.protocol !== "https:") {
    return { ok: false, reason: `Scheme "${u.protocol}" is not allowed. Use https://…` };
  }
  if (u.hostname !== GH) {
    return { ok: false, reason: `Host must be exactly github.com (got "${u.hostname}").` };
  }
  if (u.search || u.hash) {
    return { ok: false, reason: "Remove any ?query or #fragment from the URL." };
  }
  if (!/^\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(u.pathname)) {
    return { ok: false, reason: "Expected /owner/repo/pull/<number>." };
  }
  return { ok: true };
}

export function validateRepoFullName(raw) {
  const s = (raw || "").trim();
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(s)) {
    return { ok: false, reason: 'Repo must look like "owner/repo".' };
  }
  return { ok: true };
}

export function validateMinConfidence(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n)) return { ok: false, reason: "Confidence must be an integer." };
  if (n < 0 || n > 100) return { ok: false, reason: "Confidence must be between 0 and 100." };
  return { ok: true };
}

// For test-time introspection: the exact allowlist rule set, in words.
export const ALLOWLIST = Object.freeze({
  schemes: ["https:"],
  hosts: [GH],
  bannedQuery: true,
  bannedFragment: true,
});
