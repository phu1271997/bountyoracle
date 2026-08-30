// src/lib/share.js
// Web Share API with a copy-to-clipboard fallback + deep-link helpers.
//
// A bounty's canonical URL is `?bounty=<id>` on the app origin. The
// share text is built server-agnostically from bounty state so people
// know what they are clicking on before they load the page.

export function bountyDeepLink(id) {
  const base = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname}`
    : "https://bountyoracle.vercel.app/";
  return `${base}?bounty=${encodeURIComponent(id)}`;
}

export function readDeepLinkId() {
  if (typeof window === "undefined") return null;
  try {
    const u = new URL(window.location.href);
    const raw = u.searchParams.get("bounty");
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function bountyShareText(b) {
  const verdict = b.verdict ? ` — AI verdict ${b.verdict}` : "";
  return `BountyOracle #${b.bounty_id}: ${b.title || "(untitled)"}${verdict}`;
}

/**
 * Share a bounty. Uses navigator.share when available (mobile + some
 * desktop browsers), otherwise falls back to writing the deep link
 * onto the clipboard.
 *
 * Returns { ok, method }: method ∈ 'share' | 'clipboard' | 'none'.
 */
export async function shareBounty(b) {
  const url = bountyDeepLink(b.bounty_id);
  const text = bountyShareText(b);
  const payload = { title: "BountyOracle", text, url };

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return { ok: true, method: "share" };
    } catch (e) {
      // User cancelled or share failed — try clipboard as a fallback.
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, method: "clipboard" };
    } catch { /* fallthrough */ }
  }
  return { ok: false, method: "none" };
}
