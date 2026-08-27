import React from "react";

const STEPS = [
  {
    n: "Step 1",
    title: "Maintainer locks GEN on the issue",
    body:
      "create_bounty(issue_url, repo, title, min_confidence) is called payable. The GEN sent with the transaction becomes an on-chain escrow tied to that specific GitHub issue.",
  },
  {
    n: "Step 2",
    title: "Contributor claims with a PR URL",
    body:
      "claim_bounty(bounty_id, pr_url) locks the bounty to a specific pull request. The URL must be a real /pull/ link on github.com — the contract enforces both.",
  },
  {
    n: "Step 3",
    title: "Contract judges + pays itself",
    body:
      "resolve(bounty_id) reads four pages on-chain (issue, PR, diff, CI checks), asks an LLM for a verdict, and — if the validators agree — releases the escrow to the contributor automatically.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="section">
      <div className="kicker">02 · How it works</div>
      <h2>Three transactions, one on-chain verdict.</h2>
      <p className="lede">
        Every step is a real transaction against a real Intelligent Contract
        on GenLayer studionet. The AI judgement is a validator-consensus
        computation, not an API call to a private server.
      </p>
      <div className="steps">
        {STEPS.map((s) => (
          <div className="step" key={s.n}>
            <span className="step-num">{s.n}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
