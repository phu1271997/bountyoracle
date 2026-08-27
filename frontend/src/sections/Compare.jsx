import React from "react";

const ROWS = [
  ["Reads GitHub live", "Manual", "❌ oracle needed", "✅ on-chain"],
  ["Judges code quality", "Maintainer", "❌", "✅ LLM at consensus"],
  ["Pays out automatically", "Manual", "✅", "✅"],
  ["No single decider", "❌", "❌", "✅ validator jury"],
  ["Auditable rationale", "Slack thread", "❌", "✅ on-chain"],
  ["Handles unreachable PRs", "N/A", "❌", "✅ UNRESOLVABLE"],
  ["Trustless refund path", "❌", "❌", "✅"],
];

function cell(v) {
  if (v === "✅") return <span className="yes">✅</span>;
  if (v === "❌") return <span className="no">❌</span>;
  if (v.startsWith("✅")) return <span className="yes">{v}</span>;
  if (v.startsWith("❌")) return <span className="no">{v}</span>;
  return v;
}

export default function Compare() {
  return (
    <section id="compare" className="section">
      <div className="kicker">07 · Compare</div>
      <h2>Where the AI-at-consensus layer actually matters.</h2>
      <p className="lede">
        Existing bounty flows either lean on humans or hit a wall when a
        contract needs to look at the outside world. GenLayer removes both
        constraints.
      </p>
      <div className="compare-wrap">
        <table className="compare">
          <thead>
            <tr>
              <th></th>
              <th>Off-chain platform</th>
              <th>Solidity escrow</th>
              <th className="us">BountyOracle</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                <td>{r[0]}</td>
                <td>{cell(r[1])}</td>
                <td>{cell(r[2])}</td>
                <td>{cell(r[3])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
