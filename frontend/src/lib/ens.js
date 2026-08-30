// src/lib/ens.js
// Best-effort ENS reverse resolution for address chips.
//
// Uses the free public https://api.ensdata.net/<addr> endpoint. No
// key required, JSON response, CORS-friendly. Failure is silent —
// callers just render the raw address.
//
// Results are cached in-memory for the session, keyed by lowercase
// address. Concurrent hits for the same address are de-duped.

import { normalizeAddr } from "./addr.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const _cache = new Map();     // addr -> { at, ens }
const _pending = new Map();   // addr -> Promise<string|null>

/**
 * Reverse-resolve an address to its ENS primary name, or null.
 * Never throws.
 */
export async function resolveEns(address) {
  const addr = normalizeAddr(address);
  if (!addr) return null;

  const now = Date.now();
  const hit = _cache.get(addr);
  if (hit && (now - hit.at) < CACHE_TTL_MS) return hit.ens;

  if (_pending.has(addr)) return _pending.get(addr);

  const p = (async () => {
    let name = null;
    try {
      const res = await fetch(`https://api.ensdata.net/${addr}`, {
        headers: { "Accept": "application/json" },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // ensdata returns { ens: "name.eth", ... } on hit; some shapes
        // use `.name`. Cover both.
        if (data) name = (typeof data.ens === "string" && data.ens) ||
                         (typeof data.name === "string" && data.name) || null;
      }
    } catch {
      // Silent: ENS is decoration, not correctness.
    }
    _cache.set(addr, { at: Date.now(), ens: name });
    return name;
  })();

  _pending.set(addr, p);
  try { return await p; }
  finally { _pending.delete(addr); }
}

/**
 * "name.eth (0xAB…cd)" if resolved, otherwise "0xAB…cd".
 * Purely presentational — reads from cache only, never fires a fetch.
 */
export function formatWithEns(address, short) {
  const addr = normalizeAddr(address);
  if (!addr) return short || "—";
  const hit = _cache.get(addr);
  const ens = hit?.ens || null;
  if (!ens) return short || addr;
  return `${ens} · ${short || addr}`;
}
