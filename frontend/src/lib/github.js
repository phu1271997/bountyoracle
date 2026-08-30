// src/lib/github.js
// Read-only GitHub metadata enrichment.
//
// Uses api.github.com unauthenticated. The public rate limit is 60
// requests per hour per source IP, which is plenty for a demo — every
// call is behind explicit user action (opening a card, clicking
// "Check", pasting a URL). Never send anything back; never carry a
// token in the frontend.
//
// Every entry point returns { ok: true, data } | { ok: false, reason }
// so callers can render a friendly hint without a try/catch.

function _parse(url) {
  try { return new URL(url); } catch { return null; }
}

export function parseGithubUrl(url) {
  const u = _parse((url || "").trim());
  if (!u) return null;
  if (u.protocol !== "https:") return null;
  if (u.hostname !== "github.com") return null;
  const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 4) return null;
  const [owner, repo, kind, numberRaw] = parts;
  const number = parseInt(numberRaw, 10);
  if (!owner || !repo || !Number.isInteger(number)) return null;
  if (kind !== "issues" && kind !== "pull") return null;
  return { owner, repo, kind, number };
}

const _cache = new Map();
const _pending = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function _fetchJson(url) {
  // De-dupe concurrent hits for the same URL, and cache successful
  // responses for CACHE_TTL_MS so scrolling the list doesn't burn quota.
  const now = Date.now();
  const hit = _cache.get(url);
  if (hit && (now - hit.at) < CACHE_TTL_MS) return hit.value;

  if (_pending.has(url)) return _pending.get(url);

  const p = (async () => {
    let res;
    try {
      res = await fetch(url, {
        headers: {
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
    } catch (e) {
      return { ok: false, reason: "Network error contacting api.github.com." };
    }
    if (res.status === 404) return { ok: false, reason: "Not found on GitHub (404)." };
    if (res.status === 403) {
      // Almost always rate limit for unauthenticated calls.
      return { ok: false, reason: "GitHub rate-limited this browser. Try again in an hour." };
    }
    if (!res.ok) return { ok: false, reason: `GitHub API returned ${res.status}.` };
    let data;
    try { data = await res.json(); }
    catch { return { ok: false, reason: "GitHub returned non-JSON." }; }
    const value = { ok: true, data };
    _cache.set(url, { at: Date.now(), value });
    return value;
  })();

  _pending.set(url, p);
  try { return await p; }
  finally { _pending.delete(url); }
}

// ── Issue ───────────────────────────────────────────────────────────
export async function fetchIssueMeta(url) {
  const p = parseGithubUrl(url);
  if (!p || p.kind !== "issues") return { ok: false, reason: "Not a GitHub issue URL." };
  const api = `https://api.github.com/repos/${p.owner}/${p.repo}/issues/${p.number}`;
  const r = await _fetchJson(api);
  if (!r.ok) return r;
  return {
    ok: true,
    data: {
      title: r.data.title || "",
      state: r.data.state || "",       // open | closed
      html_url: r.data.html_url || url,
      updated_at: r.data.updated_at || "",
    },
  };
}

// ── Pull request ────────────────────────────────────────────────────
export async function fetchPrMeta(url) {
  const p = parseGithubUrl(url);
  if (!p || p.kind !== "pull") return { ok: false, reason: "Not a GitHub PR URL." };
  const api = `https://api.github.com/repos/${p.owner}/${p.repo}/pulls/${p.number}`;
  const r = await _fetchJson(api);
  if (!r.ok) return r;
  const d = r.data;
  return {
    ok: true,
    data: {
      title: d.title || "",
      state: d.state || "",             // open | closed
      merged: !!d.merged,               // true if merged
      draft: !!d.draft,
      html_url: d.html_url || url,
      additions: d.additions || 0,
      deletions: d.deletions || 0,
      changed_files: d.changed_files || 0,
    },
  };
}

// ── Human-readable badge ───────────────────────────────────────────
export function prStateBadge(pr) {
  if (!pr) return null;
  if (pr.merged) return { label: "merged", tone: "accepted" };
  if (pr.draft) return { label: "draft", tone: "claimed" };
  if (pr.state === "open") return { label: "open PR", tone: "open" };
  if (pr.state === "closed") return { label: "closed (unmerged)", tone: "rejected" };
  return null;
}

export function issueStateBadge(issue) {
  if (!issue) return null;
  if (issue.state === "closed") return { label: "issue closed", tone: "refunded" };
  if (issue.state === "open") return { label: "issue open", tone: "open" };
  return null;
}
