import React from "react";

function fmtGEN(base) {
  try {
    const b = BigInt(base);
    if (b === 0n) return "0";
    const whole = Number(b / 10n ** 12n) / 1e6;
    if (whole >= 1) return whole.toFixed(whole >= 10 ? 0 : 2);
    return whole.toPrecision(2);
  } catch { return "0"; }
}

export default function Stats({ bounties }) {
  const total = bounties.length;
  const totalGEN = bounties.reduce((s, b) => {
    try { return s + BigInt(b.amount); } catch { return s; }
  }, 0n);
  const accepted = bounties.filter((b) => b.status === "ACCEPTED").length;
  const verdicts = bounties.filter((b) => b.verdict).length;

  const cards = [
    { label: "Bounties", value: total, sub: "on-chain" },
    { label: "GEN escrowed", value: fmtGEN(totalGEN), sub: "across all bounties" },
    { label: "AI verdicts", value: verdicts, sub: "produced by validators" },
    { label: "Paid out", value: accepted, sub: "released to contributors" },
  ];

  return (
    <section className="stats">
      {cards.map((c) => (
        <div className="stat" key={c.label}>
          <div className="label">{c.label}</div>
          <div className="value">{c.value}</div>
          <div className="sub">{c.sub}</div>
        </div>
      ))}
    </section>
  );
}
