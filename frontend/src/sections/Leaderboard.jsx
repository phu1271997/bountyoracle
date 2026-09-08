import React, { useEffect, useState, useCallback } from "react";
import {
  getLeaderboard, getTreasury, getWithdrawable, getReputationFull, withdraw,
} from "../genlayer.js";
import { shortAddr } from "../lib/addr.js";
import { resolveEns } from "../lib/ens.js";

const TIER_CLASS = {
  Expert: "tier-expert",
  Trusted: "tier-trusted",
  Contributor: "tier-contributor",
  Newcomer: "tier-newcomer",
};

function fmtGEN(base) {
  try {
    const b = BigInt(base);
    if (b === 0n) return "0";
    const whole = Number(b / 10n ** 12n) / 1e6;
    if (whole >= 1) return `${whole.toFixed(whole >= 10 ? 2 : 3)} GEN`;
    return `${whole.toPrecision(2)} GEN`;
  } catch { return `${base}`; }
}

function TierBadge({ name }) {
  return <span className={"tier-badge " + (TIER_CLASS[name] || "tier-newcomer")}>{name}</span>;
}

function Row({ r, rank }) {
  const [name, setName] = useState(null);
  useEffect(() => {
    let off = false;
    (async () => { const n = await resolveEns(r.address); if (!off) setName(n); })();
    return () => { off = true; };
  }, [r.address]);
  const label = name ? `${name} · ${shortAddr(r.address)}` : shortAddr(r.address);
  return (
    <tr>
      <td className="lb-rank">#{rank}</td>
      <td className="lb-who">{label}</td>
      <td><TierBadge name={r.tier_name} /></td>
      <td className="lb-num">{r.accepted}</td>
      <td className="lb-num">{fmtGEN(r.earned)}</td>
      <td className="lb-num">{(r.fee_bps / 100).toFixed(2)}%</td>
    </tr>
  );
}

export default function Leaderboard({ me, onConnect }) {
  const [rows, setRows] = useState([]);
  const [treasury, setTreasury] = useState(0n);
  const [mine, setMine] = useState({ withdrawable: 0n, rep: null });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const [lb, tr] = await Promise.all([getLeaderboard(), getTreasury()]);
      setRows(lb);
      setTreasury(tr);
    } catch { /* contract may be pre-economy; ignore */ }
    if (me) {
      try {
        const [w, rep] = await Promise.all([getWithdrawable(me), getReputationFull(me)]);
        setMine({ withdrawable: w, rep });
      } catch { setMine({ withdrawable: 0n, rep: null }); }
    }
  }, [me]);

  useEffect(() => { load(); }, [load]);

  async function onWithdraw() {
    setMsg(""); setBusy(true);
    try {
      await withdraw();
      setMsg("Withdrawn. Escrow released to your wallet.");
      await load();
    } catch (e) {
      setMsg("Withdraw failed: " + (e?.message || e));
    } finally { setBusy(false); }
  }

  const hasBalance = mine.withdrawable > 0n;

  return (
    <section id="leaderboard" className="section">
      <div className="kicker">04 · Reputation economy</div>
      <div className="list-header">
        <div>
          <h2 style={{ marginBottom: 8 }}>Contributor leaderboard.</h2>
          <p className="lede" style={{ margin: 0 }}>
            Every paid win is recorded on-chain. Contributors climb from
            Newcomer to Expert, and higher tiers pay a smaller protocol fee —
            proven builders keep more of each bounty.
          </p>
        </div>
        <button className="btn-ghost" onClick={load}>Refresh</button>
      </div>

      <div className="econ-cards">
        <div className="econ-card">
          <div className="label">Protocol treasury</div>
          <div className="value">{fmtGEN(treasury)}</div>
          <div className="sub">fees funding the protocol</div>
        </div>
        <div className="econ-card">
          <div className="label">Your claimable escrow</div>
          <div className="value">{me ? fmtGEN(mine.withdrawable) : "—"}</div>
          <div className="sub">
            {me
              ? (hasBalance ? "ready to withdraw" : "nothing owed right now")
              : "connect to view"}
          </div>
          {me
            ? (
              <button
                className="btn-primary"
                style={{ marginTop: 12 }}
                disabled={busy || !hasBalance}
                onClick={onWithdraw}
              >
                {busy ? "Withdrawing…" : "Withdraw"}
              </button>
            )
            : (
              <button className="btn-ghost" style={{ marginTop: 12 }} onClick={onConnect}>
                Connect wallet
              </button>
            )}
        </div>
        <div className="econ-card">
          <div className="label">Your tier</div>
          <div className="value">
            {mine.rep ? <TierBadge name={mine.rep.tier_name} /> : "—"}
          </div>
          <div className="sub">
            {mine.rep
              ? `${mine.rep.accepted} win${mine.rep.accepted === 1 ? "" : "s"} · ${(mine.rep.fee_bps / 100).toFixed(2)}% fee`
              : "connect to view"}
          </div>
        </div>
      </div>

      {msg && <div className="hint" style={{ marginTop: 12 }}>{msg}</div>}

      <div className="lb-wrap">
        {rows.length === 0 ? (
          <div className="empty">No paid winners yet. The first accepted bounty starts the board.</div>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th>Rank</th><th>Contributor</th><th>Tier</th>
                <th className="lb-num">Wins</th><th className="lb-num">Earned</th><th className="lb-num">Fee</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => <Row key={r.address} r={r} rank={i + 1} />)}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
