import React from "react";
import { CONTRACT_ADDRESS, EXPLORER } from "../genlayer.js";

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot-inner">
        <div className="foot-grid">
          <div className="foot-col">
            <div className="foot-brand">
              <img src="/logo-256.png" alt="" />
              <strong>BountyOracle</strong>
            </div>
            <p>
              Trustless open-source bounties. An Intelligent Contract on
              GenLayer reads the PR + CI on-chain, judges with an LLM, and
              pays the contributor itself.
            </p>
          </div>
          <div className="foot-col">
            <h5>Product</h5>
            <a href="#problem">Problem</a>
            <a href="#how">How it works</a>
            <a href="#verdicts">Live verdicts</a>
            <a href="#use">How to use</a>
          </div>
          <div className="foot-col">
            <h5>Technical</h5>
            <a href="#architecture">Architecture</a>
            <a href="#signals">Why GenLayer</a>
            <a href="#compare">Compare</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="foot-col">
            <h5>Resources</h5>
            <a href="https://github.com/phu1271997/bountyoracle" target="_blank" rel="noreferrer">GitHub repo ↗</a>
            <a href={EXPLORER.address(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Contract on Explorer ↗</a>
            <a href="https://docs.genlayer.com/" target="_blank" rel="noreferrer">GenLayer docs ↗</a>
            <a href="https://studio.genlayer.com/" target="_blank" rel="noreferrer">GenLayer Studio ↗</a>
          </div>
        </div>
        <div className="foot-legal">
          <div>
            Contract{" "}
            <a href={EXPLORER.address(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
              <code>{CONTRACT_ADDRESS?.slice(0, 8)}…{CONTRACT_ADDRESS?.slice(-6)}</code>
            </a>{" "}
            on GenLayer studionet · Preview status
          </div>
          <div>Built for the GenLayer Builders program · MIT licensed</div>
        </div>
      </div>
    </footer>
  );
}
