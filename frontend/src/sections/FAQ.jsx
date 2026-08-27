import React from "react";

const QAS = [
  {
    q: "What network is the contract on?",
    a: "GenLayer studionet — the Studio-hosted network (chain 61999, RPC https://studio.genlayer.com/api). Studio deployments carry the Preview label on the Explorer catalog; that is the honest status for this build.",
  },
  {
    q: "Who runs the AI that decides ACCEPT / REJECT?",
    a: "GenLayer's validators do. When resolve() runs, each validator independently calls gl.nondet.web.render on the GitHub pages and gl.nondet.exec_prompt on the LLM. The transaction only succeeds when their verdicts converge — meaning, not shape.",
  },
  {
    q: "Do I need to hold a private key in the browser?",
    a: "No. The frontend never holds a key. It passes the connected MetaMask address to genlayer-js as a string, which routes signing through window.ethereum. Your key stays inside MetaMask, and the app auto-switches you onto chain 61999 (0xF1EF).",
  },
  {
    q: "How do I get GEN on studionet?",
    a: "Open https://studio.genlayer.com and transfer GEN from the Accounts panel to your MetaMask address. Do not use the testnet faucet — testnet and studionet are two different networks; funds on one are not spendable on the other.",
  },
  {
    q: "How long does 'Run AI judgement' take?",
    a: "Between 30 and 120 seconds in practice, because validators are literally running LLM inference before voting. The UI shows a 'Reading GitHub on-chain and reaching consensus' state for the duration.",
  },
  {
    q: "What happens if the AI can't decide?",
    a: "The verdict lands as UNRESOLVABLE (dead URL, page unreachable, or the model output cannot be coerced). The maintainer can then call refund() to reclaim the escrow. No funds are trapped.",
  },
  {
    q: "Why gl.vm.run_nondet_unsafe and not gl.vm.run_nondet?",
    a: "The current Studio build we deploy against exposes run_nondet_unsafe but not run_nondet. Our validator_fn is written defensively — it returns False on any exception path so a validator crash is treated identically to a Disagree. When run_nondet lands, swapping is a one-line change.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="section">
      <div className="kicker">08 · FAQ</div>
      <h2>Details reviewers usually ask.</h2>
      <div className="faq">
        {QAS.map((qa, i) => (
          <details key={qa.q} open={i === 0}>
            <summary>{qa.q}</summary>
            <div className="answer">{qa.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
