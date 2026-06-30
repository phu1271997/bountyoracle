// src/App.jsx
// BountyOracle — full user flow against the deployed contract:
//   browse bounties -> create+fund -> claim with PR -> trigger AI judgement ->
//   see verdict + rationale -> (auto) payout / refund.
//
// Visual direction: "merge-queue terminal". Dark slate canvas, monospace for
// data, one electric-lime accent reserved for the AI verdict moment. Status is
// encoded as a colored rail down the left of each card — the rail IS the state
// machine made visible.

import React, { useEffect, useState, useCallback } from "react";
import {
  CONTRACT_ADDRESS,
  getAccount,
  listBounties,
  createBounty,
  claimBounty,
  resolveBounty,
  refundBounty,
} from "./genlayer.js";
import "./styles.css";

const STATUS_META = {
  OPEN: { rail: "var(--open)", label: "Open" },
  CLAIMED: { rail: "var(--claimed)", label: "Awaiting judgement" },
  ACCEPTED: { rail: "var(--accent)", label: "Paid out" },
  REJECTED: { rail: "var(--reject)", label: "Rejected" },
  UNRESOLVABLE: { rail: "var(--unres)", label: "Unresolvable" },
  REFUNDED: { rail: "var(--muted)", label: "Refunded" },
};

function short(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function App() {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // {id, action}
  const [error, setError] = useState("");
  const me = (() => {
    try { return getAccount().address; } catch { return null; }
  })();

  const refresh = useCallback(async () => {
    try {
      setError("");
      const list = await listBounties();
      setBounties(list);
    } catch (e) {
      setError("Could not read bounties. Is VITE_CONTRACT_ADDRESS set?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="shell">
        <Banner>
          <strong>No contract address configured.</strong> Deploy{" "}
          <code>BountyOracle.py</code> on GenLayer Studio, then set{" "}
          <code>VITE_CONTRACT_ADDRESS</code> in your environment.
        </Banner>
      </div>
    );
  }

  return (
    <div className="shell">
      <Header me={me} />
      <CreatePanel onCreated={refresh} setBusy={setBusy} busy={busy} setError={setError} />
      {error && <Banner tone="error">{error}</Banner>}
      <section className="list">
        <div className="list-head">
          <h2>Bounties</h2>
          <button className="ghost" onClick={refresh}>Refresh</button>
        </div>
        {loading ? (
          <Skeleton />
        ) : bounties.length === 0 ? (
          <Empty />
        ) : (
          bounties
            .slice()
            .reverse()
            .map((b) => (
              <BountyCard
                key={b.bounty_id}
                b={b}
                me={me}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                onChanged={refresh}
              />
            ))
        )}
      </section>
      <Footer />
    </div>
  );
}

function Header({ me }) {
  return (
    <header className="hero">
      <div className="brand">
        <span className="dot" />
        BountyOracle
      </div>
      <p className="tag">
        Lock GEN against a GitHub issue. The contract reads the PR, the diff and
        CI on-chain, judges it with an LLM, and pays the contributor itself —
        no maintainer verdict, no middleman.
      </p>
      <div className="you">you: <code>{short(me)}</code></div>
    </header>
  );
}

function CreatePanel({ onCreated, setBusy, busy, setError }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    issueUrl: "", repoFullName: "", title: "", minConfidence: 70, value: 10000,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setError("");
    setBusy({ id: "new", action: "create" });
    try {
      await createBounty({
        issueUrl: form.issueUrl.trim(),
        repoFullName: form.repoFullName.trim(),
        title: form.title.trim(),
        minConfidence: Number(form.minConfidence),
        value: Number(form.value),
      });
      setOpen(false);
      setForm({ issueUrl: "", repoFullName: "", title: "", minConfidence: 70, value: 10000 });
      onCreated();
    } catch (e) {
      setError("Create failed: " + (e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="create">
      <button className="primary" onClick={() => setOpen(!open)}>
        {open ? "Cancel" : "Post a bounty"}
      </button>
      {open && (
        <div className="form">
          <label>Issue URL
            <input placeholder="https://github.com/owner/repo/issues/42" value={form.issueUrl} onChange={set("issueUrl")} />
          </label>
          <label>Repo (owner/repo)
            <input placeholder="owner/repo" value={form.repoFullName} onChange={set("repoFullName")} />
          </label>
          <label>Title
            <input placeholder="Fix off-by-one in parser" value={form.title} onChange={set("title")} />
          </label>
          <div className="row">
            <label>Min confidence (0–100)
              <input type="number" min="0" max="100" value={form.minConfidence} onChange={set("minConfidence")} />
            </label>
            <label>Bounty (GEN base units)
              <input type="number" min="1" value={form.value} onChange={set("value")} />
            </label>
          </div>
          <button className="primary" disabled={busy} onClick={submit}>
            {busy?.action === "create" ? "Funding…" : "Fund bounty"}
          </button>
        </div>
      )}
    </section>
  );
}

function BountyCard({ b, me, busy, setBusy, setError, onChanged }) {
  const meta = STATUS_META[b.status] || STATUS_META.OPEN;
  const [prUrl, setPrUrl] = useState("");
  const isMaintainer = me && b.maintainer?.toLowerCase() === me.toLowerCase();
  const judging = busy?.id === b.bounty_id && busy?.action === "resolve";

  async function run(action, fn) {
    setError("");
    setBusy({ id: b.bounty_id, action });
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(`${action} failed: ` + (e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card" style={{ "--rail": meta.rail }}>
      <div className="rail" />
      <div className="card-body">
        <div className="card-top">
          <span className="status" style={{ color: meta.rail }}>{meta.label}</span>
          <span className="amount">{b.amount} GEN</span>
        </div>
        <h3>{b.title || "(untitled bounty)"}</h3>
        <div className="meta">
          <a href={b.issue_url} target="_blank" rel="noreferrer">{b.repo_full_name} · issue ↗</a>
          {b.pr_url && <a href={b.pr_url} target="_blank" rel="noreferrer">PR ↗</a>}
          <span>maintainer {short(b.maintainer)}</span>
          {b.contributor && !b.contributor.endsWith("0000") && (
            <span>contributor {short(b.contributor)}</span>
          )}
        </div>

        {/* AI verdict moment */}
        {b.verdict && (
          <div className={"verdict v-" + b.verdict.toLowerCase()}>
            <div className="v-head">
              <span className="v-label">AI verdict</span>
              <span className="v-tag">{b.verdict}</span>
              {b.confidence > 0 && <span className="v-conf">{b.confidence}% conf.</span>}
            </div>
            {b.rationale && <p className="v-reason">{b.rationale}</p>}
          </div>
        )}

        {/* Actions by state */}
        <div className="actions">
          {b.status === "OPEN" && (
            <div className="claim">
              <input
                placeholder="https://github.com/owner/repo/pull/57"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
              />
              <button
                className="primary"
                disabled={busy || !prUrl}
                onClick={() => run("claim", () => claimBounty({ id: b.bounty_id, prUrl: prUrl.trim() }))}
              >
                {busy?.id === b.bounty_id && busy?.action === "claim" ? "Claiming…" : "Claim with PR"}
              </button>
            </div>
          )}

          {b.status === "CLAIMED" && (
            <button
              className="accent"
              disabled={busy}
              onClick={() => run("resolve", () => resolveBounty({ id: b.bounty_id }))}
            >
              {judging ? "AI judging on-chain…" : "Run AI judgement"}
            </button>
          )}

          {isMaintainer && ["OPEN", "UNRESOLVABLE", "REJECTED"].includes(b.status) && (
            <button
              className="ghost"
              disabled={busy}
              onClick={() => run("refund", () => refundBounty({ id: b.bounty_id }))}
            >
              {busy?.id === b.bounty_id && busy?.action === "refund" ? "Refunding…" : "Refund"}
            </button>
          )}
        </div>

        {judging && (
          <div className="consensus">
            Reading GitHub on-chain and reaching validator consensus — this can
            take a moment.
          </div>
        )}
      </div>
    </article>
  );
}

function Banner({ children, tone }) {
  return <div className={"banner " + (tone || "")}>{children}</div>;
}
function Empty() {
  return <div className="empty">No bounties yet. Post the first one above.</div>;
}
function Skeleton() {
  return <div className="empty">Loading bounties…</div>;
}
function Footer() {
  return (
    <footer className="foot">
      Settlement is performed by an Intelligent Contract on GenLayer.{" "}
      <code>{short(CONTRACT_ADDRESS)}</code>
    </footer>
  );
}
