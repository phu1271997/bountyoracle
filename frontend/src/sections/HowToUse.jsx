import React from "react";

const STEPS = [
  {
    h: "Install MetaMask",
    b: "You'll sign every transaction from your own wallet. The app never stores a key.",
  },
  {
    h: "Fund the wallet on studionet",
    b: "Open https://studio.genlayer.com → Accounts panel → transfer GEN to your MetaMask address. Skip the testnet faucet — that's a different network.",
  },
  {
    h: "Click Connect MetaMask",
    b: "Approve the two prompts: add GenLayer Studio Network (chain 61999), then switch to it. The header now shows your address as a chip.",
  },
  {
    h: "Post a bounty",
    b: "Click Post a bounty in the Live verdicts section. Paste a real GitHub issue URL, the repo, a title, a min-confidence threshold and a GEN amount. Confirm in MetaMask.",
  },
  {
    h: "Claim with a PR",
    b: "As any contributor, paste a real GitHub /pull/ URL on the OPEN card. The bounty moves to Awaiting judgement.",
  },
  {
    h: "Run the AI judgement",
    b: "Click Run AI judgement. Wait 30–120 s for consensus. The card fills in with verdict, confidence, and rationale — and if ACCEPT, the escrow is released to the contributor.",
  },
];

export default function HowToUse() {
  return (
    <section id="use" className="section">
      <div className="kicker">09 · How to use it</div>
      <h2>Six steps from wallet install to on-chain payout.</h2>
      <div className="timeline">
        {STEPS.map((s, i) => (
          <div className="timeline-step" key={s.h}>
            <div className="idx">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <h4>{s.h}</h4>
              <p>{s.b}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
