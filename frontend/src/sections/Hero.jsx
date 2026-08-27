import React from "react";

export default function Hero({ me, onConnect }) {
  return (
    <section id="top" className="hero">
      <div>
        <span className="hero-badge">
          <span className="live-dot" />
          Live on GenLayer studionet
        </span>
        <h1>
          Bounties that <span className="grad">judge themselves</span>.
        </h1>
        <p className="lede">
          Lock GEN against a GitHub issue. When a contributor submits a pull
          request, an Intelligent Contract on GenLayer reads the PR, the
          diff, and the CI checks on-chain, reasons about them with an LLM,
          and pays the contributor itself — no maintainer verdict, no
          middleman.
        </p>
        <div className="hero-ctas">
          {me ? (
            <a className="btn-primary" href="#verdicts">See live verdicts</a>
          ) : (
            <button className="btn-primary" onClick={onConnect}>
              Connect MetaMask
            </button>
          )}
          <a className="btn-ghost" href="#how">How it works ↓</a>
        </div>
      </div>
      <div className="hero-visual">
        <div className="glow" />
        <img src="/logo-1024.png" alt="BountyOracle infinity mark" />
      </div>
    </section>
  );
}
