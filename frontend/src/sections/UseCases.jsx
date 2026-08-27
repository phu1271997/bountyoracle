import React from "react";

const CASES = [
  {
    icon: "🐛",
    title: "Bug-bounty for OSS libraries",
    body:
      "A maintainer posts a bounty on a real issue. Any contributor claims it with a PR. The contract only pays when the PR closes the exact issue and CI is green.",
  },
  {
    icon: "🧪",
    title: "Test-coverage bounties",
    body:
      "Fund an issue asking for coverage on module X. The judge reads the diff and the checks and only accepts when tests actually land for X — not for unrelated files.",
  },
  {
    icon: "📚",
    title: "Docs / typo bounties",
    body:
      "Small maintenance work is often left undone because reviewing is too much effort. Automate the review: post the bounty, let the contract check what changed.",
  },
  {
    icon: "🚀",
    title: "Feature bounties with milestones",
    body:
      "Split a big feature into issues, each with its own bounty and its own minimum-confidence threshold. Each PR gets a fresh, independent AI judgement.",
  },
];

export default function UseCases() {
  return (
    <section id="usecases" className="section">
      <div className="kicker">06 · Use cases</div>
      <h2>Every OSS maintainer's backlog, but self-settling.</h2>
      <div className="grid-4">
        {CASES.map((c) => (
          <div className="tile" key={c.title}>
            <div className="tile-icon" style={{ fontFamily: "inherit" }}>{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
