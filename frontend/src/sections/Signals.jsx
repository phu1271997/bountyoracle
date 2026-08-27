import React from "react";

const SIGNALS = [
  {
    icon: "🌐",
    title: "Reads live GitHub on-chain",
    body:
      "gl.nondet.web.render(url) fetches the issue, PR, diff, and CI pages directly inside the contract. No oracle service, no signed relay — every validator does it themselves.",
  },
  {
    icon: "🧠",
    title: "LLM reasoning at consensus time",
    body:
      "gl.nondet.exec_prompt runs a strict-mode judge across all validators. The verdict is not a single model's opinion — it is the answer that a diverse validator jury agrees on.",
  },
  {
    icon: "⚖️",
    title: "Validators check meaning, not shape",
    body:
      "Our validator function re-reads GitHub and re-judges. The run only succeeds when the leader and validators produce the same decision — not just the same JSON schema.",
  },
  {
    icon: "🔒",
    title: "No off-chain trust",
    body:
      "The escrow, the reading, the reasoning, the settlement — all four live in the contract. Remove the on-chain web read plus LLM and the product has nothing left to do.",
  },
];

export default function Signals() {
  return (
    <section id="signals" className="section">
      <div className="kicker">04 · Why GenLayer</div>
      <h2>The four things Solidity cannot do.</h2>
      <p className="lede">
        BountyOracle is not a normal smart-contract app with an AI garnish on
        top. It relies on capabilities that only exist because GenLayer put
        an LLM inside the consensus layer.
      </p>
      <div className="grid-4">
        {SIGNALS.map((s) => (
          <div className="tile" key={s.title}>
            <div className="tile-icon" style={{ fontFamily: "inherit" }}>{s.icon}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
