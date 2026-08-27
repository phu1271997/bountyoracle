import React from "react";

const PROBLEMS = [
  {
    icon: "01",
    title: "Maintainer becomes sole judge",
    body:
      "Someone still has to read the PR, decide if it truly fixes the issue, and click merge. That gatekeeper is a single point of failure, an unpaid bottleneck, and often the reason bounties never settle.",
  },
  {
    icon: "02",
    title: "Contributors distrust promises",
    body:
      "Off-chain bounties can quietly disappear. The contributor ships the fix and then waits — and hopes. Without an on-chain settlement rule, the money is only ever a maintainer's promise.",
  },
  {
    icon: "03",
    title: "Solidity can't read the work",
    body:
      "A normal smart contract cannot fetch github.com or reason about code quality. So classic bounty escrows fall back on manual signals or trusted oracles — reintroducing the exact human judge they set out to remove.",
  },
];

export default function Problem() {
  return (
    <section id="problem" className="section">
      <div className="kicker">01 · Problem</div>
      <h2>Open-source bounties don't settle themselves.</h2>
      <p className="lede">
        Every existing bounty platform depends on someone deciding — a
        maintainer, a moderator, a trusted admin. That someone is the reason
        bounties break down.
      </p>
      <div className="grid-3">
        {PROBLEMS.map((p) => (
          <div className="tile" key={p.title}>
            <div className="tile-icon">{p.icon}</div>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
