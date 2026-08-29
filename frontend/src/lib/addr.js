// src/lib/addr.js
// Case-insensitive address helpers.
//
// GenLayer's Address values round-trip through hex strings and can be
// recorded with mixed casing. Treating "0xAB…" and "0xab…" as
// different values is a subtle bug — the wallet may connect in one
// case and the contract may have stored the other. Every UI path that
// asks "is this the maintainer?" or renders a chip must go through
// these helpers.

const ZERO = "0x0000000000000000000000000000000000000000";

export function normalizeAddr(a) {
  if (typeof a !== "string") return null;
  const s = a.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  return s.toLowerCase();
}

export function addressEquals(a, b) {
  const na = normalizeAddr(a);
  const nb = normalizeAddr(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function isZeroAddr(a) {
  const n = normalizeAddr(a);
  return n === ZERO;
}

export function shortAddr(a, left = 6, right = 4) {
  const n = normalizeAddr(a);
  if (!n) return "—";
  return n.slice(0, left) + "…" + n.slice(-right);
}

export const ZERO_ADDRESS = ZERO;
