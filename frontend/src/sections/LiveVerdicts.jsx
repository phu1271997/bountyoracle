import React, { useState } from "react";
import {
  createBounty, claimBounty, resolveBounty, refundBounty,
} from "../genlayer.js";

const STATUS_META = {
  OPEN:         { rail: "var(--open)",      label: "Open",              tone: "open" },
  CLAIMED:      { rail: "var(--claimed)",   label: "Awaiting judgement", tone: "claimed" },
  ACCEPTED:     { rail: "var(--accepted)",  label: "Paid out",           tone: "accepted" },
  REJECTED:     { rail: "var(--rejected)",  label: "Rejected",           tone: "rejected" },
  UNRESOLVABLE: { rail: "var(--unres)",     label: "Unresolvable",       tone: "unres" },
  REFUNDED:     { rail: "var(--refunded)",  label: "Refunded",           tone: "refunded" },
};

const FILTERS = ["ALL", "OPEN", "CLAIMED", "ACCEPTED", "REJECTED", "UNRESOLVABLE", "REFUNDED"];

function short(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
function fmtGEN(base) {
  try {
    const b = BigInt(base);
    if (b >= 10n ** 15n) {
      const whole = Number(b / 10n ** 12n) / 1e6;
      return `${whole} GEN`;
    }
    return `${b.toString()} base`;
  } catch { return `${base}`; }
}

export default function LiveVerdicts({
  bounties, loading, refresh, me, onConnect, busy, setBusy, error, setError,
}) {
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "ALL" ? bounties.length : bounties.filter((b) => b.status === f).length;
    return acc;
  }, {});
  const shown = filter === "ALL"
    ? bounties.slice().reverse()
    : bounties.filter((b) => b.status === filter).reverse();

  return (
    <section id="verdicts" className="section">
      <div className="kicker">03 · Live on-chain</div>
      <div className="list-header">
        <div>
          <h2 style={{ marginBottom: 8 }}>Live verdicts, straight from the contract.</h2>
          <p className="lede" style={{ margin: 0 }}>
            Every card below is real state on studionet. Every verdict was
            produced by validator consensus, not by this app's server.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={refresh}>Refresh</button>
          {me ? (
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "Post a bounty"}
            </button>
          ) : (
            <button className="btn-primary" onClick={onConnect}>Connect to post</button>
          )}
        </div>
      </div>

      {showForm && me && (
        <CreateForm
          setBusy={setBusy}
          busy={busy}
          setError={setError}
          onCreated={() => { setShowForm(false); refresh(); }}
        />
      )}
      {error && <div className="banner error">{error}</div>}

      <div className="filters" style={{ margin: "20px 0 24px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={"filter-chip " + (filter === f ? "active" : "")}
            onClick={() => setFilter(f)}
          >
            {f}
            <span className="cnt">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="list">
        {loading ? (
          <div className="empty">Loading bounties…</div>
        ) : shown.length === 0 ? (
          <div className="empty">No bounties match this filter.</div>
        ) : (
          shown.map((b) => (
            <BountyCard
              key={b.bounty_id}
              b={b}
              me={me}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onChanged={refresh}
              onConnect={onConnect}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CreateForm({ onCreated, setBusy, busy, setError }) {
  const [form, setForm] = useState({
    issueUrl: "", repoFullName: "", title: "", minConfidence: 70, value: 1,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function submit() {
    setError("");
    setBusy({ id: "new", action: "create" });
    try {
      const base = BigInt(Math.floor(Number(form.value) * 1e6)) * (10n ** 12n);
      await createBounty({
        issueUrl: form.issueUrl.trim(),
        repoFullName: form.repoFullName.trim(),
        title: form.title.trim(),
        minConfidence: Number(form.minConfidence),
        value: base,
      });
      setForm({ issueUrl: "", repoFullName: "", title: "", minConfidence: 70, value: 1 });
      onCreated();
    } catch (e) {
      setError("Create failed: " + (e?.message || e));
    } finally { setBusy(null); }
  }
  return (
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
        <label>Bounty (GEN)
          <input type="number" min="0.000001" step="0.1" value={form.value} onChange={set("value")} />
        </label>
      </div>
      <button className="btn-primary" disabled={busy} onClick={submit}>
        {busy?.action === "create" ? "Signing + funding…" : "Fund bounty"}
      </button>
      <p className="hint">
        The GEN sent with this transaction becomes the escrow. It only
        releases to the contributor when the on-chain AI verdict is ACCEPT
        with confidence ≥ your minimum.
      </p>
    </div>
  );
}

function BountyCard({ b, me, busy, setBusy, setError, onChanged, onConnect }) {
  const meta = STATUS_META[b.status] || STATUS_META.OPEN;
  const [prUrl, setPrUrl] = useState("");
  const isMaintainer = me && b.maintainer?.toLowerCase() === me.toLowerCase();
  const judging = busy?.id === b.bounty_id && busy?.action === "resolve";

  async function run(action, fn) {
    setError("");
    setBusy({ id: b.bounty_id, action });
    try { await fn(); onChanged(); }
    catch (e) { setError(`${action} failed: ` + (e?.message || e)); }
    finally { setBusy(null); }
  }

  return (
    <article className="card" style={{ "--rail": meta.rail }}>
      <div className="rail" />
      <div className="card-body">
        <div className="card-top">
          <span className="card-status" style={{ color: meta.rail }}>#{b.bounty_id} · {meta.label}</span>
          <span className="card-amount">{fmtGEN(b.amount)}</span>
        </div>
        <h3>{b.title || "(untitled bounty)"}</h3>
        <div className="card-meta">
          <a href={b.issue_url} target="_blank" rel="noreferrer">{b.repo_full_name} · issue ↗</a>
          {b.pr_url && <a href={b.pr_url} target="_blank" rel="noreferrer">PR ↗</a>}
          <span>maintainer {short(b.maintainer)}</span>
          {b.contributor && !b.contributor.endsWith("0000") && (
            <span>contributor {short(b.contributor)}</span>
          )}
          <span>min conf {b.min_confidence}%</span>
        </div>

        {b.verdict && (
          <div className="verdict">
            <div className="verdict-head">
              <span className="verdict-label">AI verdict</span>
              <span className={"verdict-tag v-" + b.verdict.toLowerCase()}>{b.verdict}</span>
              {b.confidence > 0 && <span className="verdict-conf">{b.confidence}% confidence</span>}
            </div>
            {b.rationale && <p className="verdict-reason">{b.rationale}</p>}
          </div>
        )}

        <div className="actions">
          {b.status === "OPEN" && (
            me ? (
              <div className="claim">
                <input
                  placeholder="https://github.com/owner/repo/pull/57"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                />
                <button
                  className="btn-primary"
                  disabled={busy || !prUrl}
                  onClick={() => run("claim", () => claimBounty({ id: b.bounty_id, prUrl: prUrl.trim() }))}
                >
                  {busy?.id === b.bounty_id && busy?.action === "claim" ? "Claiming…" : "Claim with PR"}
                </button>
              </div>
            ) : (
              <button className="btn-ghost" onClick={onConnect}>Connect wallet to claim</button>
            )
          )}
          {b.status === "CLAIMED" && (
            me ? (
              <button
                className="btn-primary"
                disabled={busy}
                onClick={() => run("resolve", () => resolveBounty({ id: b.bounty_id }))}
              >
                {judging ? "AI judging on-chain…" : "Run AI judgement"}
              </button>
            ) : (
              <button className="btn-ghost" onClick={onConnect}>Connect wallet to run judgement</button>
            )
          )}
          {isMaintainer && ["OPEN", "UNRESOLVABLE", "REJECTED"].includes(b.status) && (
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => run("refund", () => refundBounty({ id: b.bounty_id }))}
            >
              {busy?.id === b.bounty_id && busy?.action === "refund" ? "Refunding…" : "Refund"}
            </button>
          )}
        </div>

        {judging && (
          <div className="consensus">
            Reading GitHub on-chain and reaching validator consensus — this
            takes 30–90 seconds while validators run LLM inference.
          </div>
        )}
      </div>
    </article>
  );
}
