import React from "react";

const LINKS = [
  ["problem", "Problem"],
  ["how", "How it works"],
  ["verdicts", "Live verdicts"],
  ["signals", "Why GenLayer"],
  ["architecture", "Architecture"],
  ["compare", "Compare"],
  ["faq", "FAQ"],
];

function short(addr) {
  if (!addr) return "";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function Nav({ me, onConnect }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="nav-brand" href="#top">
          <img src="/logo-512.png" alt="BountyOracle" />
          <span>BountyOracle</span>
        </a>
        <div className="nav-links">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </div>
        <div className="nav-actions">
          <a
            className="nav-github"
            href="https://github.com/phu1271997/bountyoracle"
            target="_blank"
            rel="noreferrer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.7 5.39-5.26 5.67.41.36.78 1.05.78 2.12v3.14c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/>
            </svg>
            GitHub
          </a>
          {me ? (
            <span className="chip"><span className="dot" />{short(me)}</span>
          ) : (
            <button className="btn-primary btn-icon" onClick={onConnect}>
              Connect MetaMask
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
