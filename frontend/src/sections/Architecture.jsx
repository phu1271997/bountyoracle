import React from "react";

export default function Architecture() {
  return (
    <section id="architecture" className="section">
      <div className="kicker">05 · Architecture</div>
      <h2>The whole judgement runs inside one transaction.</h2>
      <p className="lede">
        No off-chain worker. No signed oracle relay. When resolve() is
        called, each validator does the full pipeline itself — reads
        GitHub, calls its LLM, votes on a verdict — and consensus reduces
        the answers to one.
      </p>
      <div className="arch">
        <svg viewBox="0 0 1000 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Architecture diagram">
          <defs>
            <linearGradient id="archGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2540d8"/>
              <stop offset="1" stopColor="#28d0ff"/>
            </linearGradient>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8f9dc5"/>
            </marker>
          </defs>

          {/* Frontend box */}
          <g transform="translate(30 30)">
            <rect width="220" height="90" rx="12" fill="#121835" stroke="#253062"/>
            <text x="20" y="30" fill="#8f9dc5" fontFamily="JetBrains Mono" fontSize="11">FRONTEND (Vite + React)</text>
            <text x="20" y="55" fill="#e8ecff" fontFamily="Inter" fontSize="15" fontWeight="700">MetaMask signs</text>
            <text x="20" y="75" fill="#8f9dc5" fontFamily="Inter" fontSize="12">genlayer-js · studionet</text>
          </g>

          {/* Contract box */}
          <g transform="translate(390 30)">
            <rect width="240" height="90" rx="12" fill="url(#archGrad)" opacity="0.15"/>
            <rect width="240" height="90" rx="12" fill="none" stroke="#2c9df6"/>
            <text x="20" y="30" fill="#28d0ff" fontFamily="JetBrains Mono" fontSize="11">INTELLIGENT CONTRACT (Python)</text>
            <text x="20" y="55" fill="#e8ecff" fontFamily="Inter" fontSize="15" fontWeight="700">BountyOracle</text>
            <text x="20" y="75" fill="#8f9dc5" fontFamily="Inter" fontSize="12">create · claim · resolve · refund</text>
          </g>

          {/* Explorer box */}
          <g transform="translate(770 30)">
            <rect width="200" height="90" rx="12" fill="#121835" stroke="#253062"/>
            <text x="20" y="30" fill="#8f9dc5" fontFamily="JetBrains Mono" fontSize="11">EXPLORER</text>
            <text x="20" y="55" fill="#e8ecff" fontFamily="Inter" fontSize="15" fontWeight="700">Audit trail</text>
            <text x="20" y="75" fill="#8f9dc5" fontFamily="Inter" fontSize="12">explorer-studio.genlayer.com</text>
          </g>

          {/* Arrows top row */}
          <line x1="250" y1="75" x2="390" y2="75" stroke="#8f9dc5" strokeWidth="2" markerEnd="url(#arrow)"/>
          <line x1="630" y1="75" x2="770" y2="75" stroke="#8f9dc5" strokeWidth="2" markerEnd="url(#arrow)"/>
          <text x="290" y="65" fill="#8f9dc5" fontFamily="JetBrains Mono" fontSize="10">tx</text>
          <text x="680" y="65" fill="#8f9dc5" fontFamily="JetBrains Mono" fontSize="10">records</text>

          {/* Consensus band */}
          <g transform="translate(30 170)">
            <rect width="940" height="130" rx="14" fill="#0d1224" stroke="#253062"/>
            <text x="20" y="28" fill="#28d0ff" fontFamily="JetBrains Mono" fontSize="11">GENLAYER CONSENSUS — each validator runs this in parallel</text>

            {/* 5 validator columns */}
            {Array.from({ length: 5 }).map((_, i) => (
              <g key={i} transform={`translate(${40 + i * 180} 46)`}>
                <rect width="150" height="70" rx="10" fill="#121835" stroke="#253062"/>
                <text x="12" y="20" fill="#8f9dc5" fontFamily="JetBrains Mono" fontSize="10">Validator {i + 1}</text>
                <text x="12" y="38" fill="#e8ecff" fontFamily="Inter" fontSize="12">gl.nondet.web.render</text>
                <text x="12" y="55" fill="#e8ecff" fontFamily="Inter" fontSize="12">gl.nondet.exec_prompt</text>
              </g>
            ))}
          </g>

          {/* Down arrow to verdict */}
          <line x1="500" y1="300" x2="500" y2="345" stroke="#8f9dc5" strokeWidth="2" markerEnd="url(#arrow)"/>
          <text x="510" y="325" fill="#8f9dc5" fontFamily="JetBrains Mono" fontSize="10">majority verdict</text>

          {/* Terminal states */}
          <g transform="translate(120 355)">
            <rect width="180" height="80" rx="12" fill="rgba(52, 211, 153, 0.12)" stroke="#34d399"/>
            <text x="18" y="28" fill="#34d399" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">ACCEPT</text>
            <text x="18" y="50" fill="#e8ecff" fontFamily="Inter" fontSize="13">Escrow released</text>
            <text x="18" y="68" fill="#8f9dc5" fontFamily="Inter" fontSize="12">→ contributor paid</text>
          </g>

          <g transform="translate(410 355)">
            <rect width="180" height="80" rx="12" fill="rgba(248, 113, 113, 0.12)" stroke="#f87171"/>
            <text x="18" y="28" fill="#f87171" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">REJECT</text>
            <text x="18" y="50" fill="#e8ecff" fontFamily="Inter" fontSize="13">Bounty reopens</text>
            <text x="18" y="68" fill="#8f9dc5" fontFamily="Inter" fontSize="12">→ next contributor</text>
          </g>

          <g transform="translate(700 355)">
            <rect width="180" height="80" rx="12" fill="rgba(181, 167, 255, 0.14)" stroke="#b5a7ff"/>
            <text x="18" y="28" fill="#b5a7ff" fontFamily="JetBrains Mono" fontSize="11" fontWeight="700">UNRESOLVABLE</text>
            <text x="18" y="50" fill="#e8ecff" fontFamily="Inter" fontSize="13">Pages unreachable</text>
            <text x="18" y="68" fill="#8f9dc5" fontFamily="Inter" fontSize="12">→ maintainer refunds</text>
          </g>
        </svg>
      </div>
    </section>
  );
}
