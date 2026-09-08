import React, { useEffect, useState } from "react";
import {
  createBounty, claimBounty, resolveBounty, refundBounty,
} from "../genlayer.js";
import {
  validateIssueUrl, validatePrUrl, validateRepoFullName, validateMinConfidence,
} from "../lib/validate.js";
import { addressEquals, isZeroAddr, shortAddr } from "../lib/addr.js";
import {
  fetchIssueMeta, fetchPrMeta, prStateBadge, issueStateBadge,
} from "../lib/github.js";
import { resolveEns, formatWithEns } from "../lib/ens.js";
import { shareBounty, bountyDeepLink, readDeepLinkId } from "../lib/share.js";

// Phase 3 — competitive model. A bounty stays OPEN and collects rival PRs
// from many contributors; the maintainer runs one comparative AI judgement
// that ranks them and pays only the single winner.
const STATUS_META = {
  OPEN:         { rail: "var(--open)",      label: "Open · accepting PRs", tone: "open" },
  ACCEPTED:     { rail: "var(--accepted)",  label: "Winner paid",          tone: "accepted" },
  REJECTED:     { rail: "var(--rejected)",  label: "No PR qualified",      tone: "rejected" },
  UNRESOLVABLE: { rail: "var(--unres)",     label: "Unresolvable",         tone: "unres" },
  REFUNDED:     { rail: "var(--refunded)",  label: "Refunded",             tone: "refunded" },
};

const FILTERS = ["ALL", "OPEN", "ACCEPTED", "REJECTED", "UNRESOLVABLE", "REFUNDED"];

const short = shortAddr;

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
  // Phase 3: deep link — read ?bounty=N once, on mount.
  const [highlightId] = useState(() => readDeepLinkId());
  // Warm the ENS cache for maintainers/contributors before their cards
  // render, so the chips fill in on the first paint after data.
  useEffect(() => {
    for (const b of bounties) {
      resolveEns(b.maintainer);
      if (b.contributor && !isZeroAddr(b.contributor)) resolveEns(b.contributor);
      for (const s of (b.submissions || [])) resolveEns(s.contributor);
    }
  }, [bounties]);

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
            Every card below is real state on studionet. Contributors compete
            with rival PRs; the winner is chosen by validator consensus, not by
            this app's server.
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
              highlighted={highlightId === b.bounty_id}
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
  const [localError, setLocalError] = useState("");
  const [issueHint, setIssueHint] = useState(null); // { ok, title|reason, state? }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Phase 3 integration: GitHub metadata enrichment. When the issue URL
  // parses cleanly, fetch title + state so the user sees what they are
  // about to bounty AND we can auto-fill the repo/title fields.
  useEffect(() => {
    const url = form.issueUrl.trim();
    if (!url) { setIssueHint(null); return; }
    if (!validateIssueUrl(url).ok) { setIssueHint(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await fetchIssueMeta(url);
      if (cancelled) return;
      setIssueHint(r);
      if (r.ok) {
        setForm((f) => ({
          ...f,
          title: f.title || r.data.title,
          repoFullName: f.repoFullName || (() => {
            const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\//);
            return m ? `${m[1]}/${m[2]}` : "";
          })(),
        }));
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.issueUrl]);

  async function submit() {
    setError(""); setLocalError("");
    const checks = [
      ["Issue URL", validateIssueUrl(form.issueUrl)],
      ["Repo",      validateRepoFullName(form.repoFullName)],
      ["Confidence", validateMinConfidence(form.minConfidence)],
    ];
    for (const [label, res] of checks) {
      if (!res.ok) { setLocalError(`${label}: ${res.reason}`); return; }
    }
    if (!(Number(form.value) > 0)) {
      setLocalError("Bounty amount must be greater than 0."); return;
    }
    if (issueHint?.ok && issueHint.data.state === "closed") {
      setLocalError("GitHub says this issue is already closed. Post a bounty on an OPEN issue.");
      return;
    }
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
      {issueHint && (
        <div
          className={"banner " + (issueHint.ok
            ? (issueHint.data.state === "closed" ? "error" : "warn")
            : "warn")}
          style={{ margin: 0 }}
        >
          {issueHint.ok
            ? `GitHub: "${issueHint.data.title}" — issue ${issueHint.data.state}.`
            : `GitHub check skipped: ${issueHint.reason}`}
        </div>
      )}
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
      {localError && <div className="banner error">{localError}</div>}
      <button className="btn-primary" disabled={busy} onClick={submit}>
        {busy?.action === "create" ? "Signing + funding…" : "Fund bounty"}
      </button>
      <p className="hint">
        The GEN sent with this transaction becomes the escrow. Any number of
        contributors can then submit rival PRs. It releases to the single PR
        the on-chain AI ranks best — if it clears your minimum confidence.
      </p>
    </div>
  );
}

// One row per rival PR: contributor (ENS), PR link, live GitHub badge, and —
// once judged — the AI rank + note. The winner is crowned.
function SubmissionRow({ s, me, isWinner, judged }) {
  const [prMeta, setPrMeta] = useState(null);
  const [name, setName] = useState(null);
  const mine = addressEquals(me, s.contributor);

  useEffect(() => {
    let cancelled = false;
    if (!s.pr_url) { setPrMeta(null); return; }
    (async () => {
      const r = await fetchPrMeta(s.pr_url);
      if (!cancelled) setPrMeta(r.ok ? r.data : null);
    })();
    return () => { cancelled = true; };
  }, [s.pr_url]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = await resolveEns(s.contributor);
      if (!cancelled) setName(n);
    })();
    return () => { cancelled = true; };
  }, [s.contributor]);

  const badge = prStateBadge(prMeta);
  const label = name ? `${name} · ${short(s.contributor)}` : short(s.contributor);

  return (
    <div className={"submission" + (isWinner ? " winner" : "")}>
      <div className="submission-main">
        <span className="submission-who">
          {isWinner && <span title="Winner">👑 </span>}
          {label}{mine && <span className="you-tag"> (you)</span>}
        </span>
        <a href={s.pr_url} target="_blank" rel="noreferrer">PR ↗</a>
        {badge && (
          <span
            className={"verdict-tag v-" + (badge.tone === "accepted" ? "accept" :
              badge.tone === "rejected" ? "reject" : badge.tone === "unres" ? "unresolvable" : "")}
            style={{ padding: "2px 8px", fontSize: 11 }}
          >
            GitHub: {badge.label}
          </span>
        )}
        {judged && s.rank > 0 && (
          <span className="rank-tag">{isWinner ? "Ranked #1" : `Rank #${s.rank}`}</span>
        )}
      </div>
      {judged && s.note && <p className="submission-note">{s.note}</p>}
    </div>
  );
}

function BountyCard({ b, me, busy, setBusy, setError, onChanged, onConnect, highlighted }) {
  const meta = STATUS_META[b.status] || STATUS_META.OPEN;
  const [prUrl, setPrUrl] = useState("");
  const [claimError, setClaimError] = useState("");
  const [prMeta, setPrMeta] = useState(null); // GH enrichment for the input URL
  const [maintName, setMaintName] = useState(null);
  const [shareMsg, setShareMsg] = useState("");
  const isMaintainer = addressEquals(me, b.maintainer);
  const hasContributor = !isZeroAddr(b.contributor);
  const submissions = b.submissions || [];
  const judged = ["ACCEPTED", "REJECTED"].includes(b.status);
  const judging = busy?.id === b.bounty_id && busy?.action === "resolve";
  const cardRef = React.useRef(null);

  // Validate the PR the user is about to submit against GitHub's live state.
  useEffect(() => {
    let cancelled = false;
    if (!prUrl || !validatePrUrl(prUrl.trim()).ok) { setPrMeta(null); return; }
    const t = setTimeout(async () => {
      const r = await fetchPrMeta(prUrl.trim());
      if (!cancelled) setPrMeta(r.ok ? r.data : null);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [prUrl]);

  // Reverse-resolve ENS for the maintainer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = await resolveEns(b.maintainer);
      if (!cancelled) setMaintName(n);
    })();
    return () => { cancelled = true; };
  }, [b.maintainer]);

  // Deep-link highlight — scroll into view + flash a border.
  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  async function run(action, fn) {
    setError("");
    setBusy({ id: b.bounty_id, action });
    try { await fn(); onChanged(); }
    catch (e) { setError(`${action} failed: ` + (e?.message || e)); }
    finally { setBusy(null); }
  }

  function submitClaim() {
    setClaimError("");
    const check = validatePrUrl(prUrl.trim());
    if (!check.ok) { setClaimError(check.reason); return; }
    if (prMeta && prMeta.state === "closed" && !prMeta.merged) {
      setClaimError("GitHub says this PR is closed without merge. Pick another PR.");
      return;
    }
    return run("claim", async () => {
      await claimBounty({ id: b.bounty_id, prUrl: prUrl.trim() });
      setPrUrl("");
    });
  }

  async function onShare() {
    const r = await shareBounty(b);
    if (r.ok) {
      setShareMsg(r.method === "clipboard" ? "Link copied to clipboard." : "Shared.");
    } else {
      setShareMsg("Could not share — copy manually: " + bountyDeepLink(b.bounty_id));
    }
    setTimeout(() => setShareMsg(""), 3000);
  }

  const maintLabel = maintName ? `${maintName} · ${short(b.maintainer)}` : short(b.maintainer);
  const canResolve = isMaintainer && b.status === "OPEN" && submissions.length > 0;

  return (
    <article
      ref={cardRef}
      className="card"
      style={{
        "--rail": meta.rail,
        boxShadow: highlighted ? "0 0 0 2px var(--brand-3), 0 10px 30px rgba(44, 157, 246, 0.35)" : undefined,
      }}
    >
      <div className="rail" />
      <div className="card-body">
        <div className="card-top">
          <span className="card-status" style={{ color: meta.rail }}>#{b.bounty_id} · {meta.label}</span>
          <span className="card-amount">{fmtGEN(b.amount)}</span>
        </div>
        <h3>{b.title || "(untitled bounty)"}</h3>
        <div className="card-meta">
          <a href={b.issue_url} target="_blank" rel="noreferrer">{b.repo_full_name} · issue ↗</a>
          <span>maintainer {maintLabel}</span>
          <span>min conf {b.min_confidence}%</span>
          <span className="competitors">
            {submissions.length} {submissions.length === 1 ? "PR" : "PRs"} competing
          </span>
        </div>

        {submissions.length > 0 && (
          <div className="submissions">
            <div className="submissions-head">Rival pull requests</div>
            {submissions.map((s) => (
              <SubmissionRow
                key={s.index}
                s={s}
                me={me}
                judged={judged}
                isWinner={b.status === "ACCEPTED" && b.winner_index === s.index}
              />
            ))}
          </div>
        )}

        {b.verdict && (
          <div className="verdict">
            <div className="verdict-head">
              <span className="verdict-label">AI verdict</span>
              <span className={"verdict-tag v-" + b.verdict.toLowerCase()}>{b.verdict}</span>
              {b.confidence > 0 && <span className="verdict-conf">{b.confidence}% confidence</span>}
              {b.canary_verified && (
                <span className="verdict-tag" title="Prompt-injection canary echoed by both validators" style={{ padding: "2px 8px", fontSize: 11 }}>
                  🛡 canary ok
                </span>
              )}
            </div>
            {b.rationale && <p className="verdict-reason">{b.rationale}</p>}
          </div>
        )}

        <div className="actions">
          {b.status === "OPEN" && (
            me ? (
              <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 260 }}>
                <div className="claim">
                  <input
                    placeholder="https://github.com/owner/repo/pull/57"
                    value={prUrl}
                    onChange={(e) => { setPrUrl(e.target.value); setClaimError(""); }}
                  />
                  <button
                    className="btn-primary"
                    disabled={busy || !prUrl}
                    onClick={submitClaim}
                  >
                    {busy?.id === b.bounty_id && busy?.action === "claim" ? "Submitting…" : "Submit your PR"}
                  </button>
                </div>
                {claimError && (
                  <div className="banner error" style={{ margin: 0, padding: "10px 14px" }}>
                    {claimError}
                  </div>
                )}
              </div>
            ) : (
              <button className="btn-ghost" onClick={onConnect}>Connect wallet to submit a PR</button>
            )
          )}
          {canResolve && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => run("resolve", () => resolveBounty({ id: b.bounty_id }))}
            >
              {judging ? "AI judging on-chain…" : `Run AI judgement (${submissions.length} PRs)`}
            </button>
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
          <button
            className="btn-ghost"
            onClick={onShare}
            title="Share this bounty (Web Share API or clipboard)"
          >
            Share ↗
          </button>
        </div>

        {shareMsg && (
          <div className="hint" style={{ marginTop: 8 }}>{shareMsg}</div>
        )}

        {judging && (
          <div className="consensus">
            Reading every rival PR on GitHub on-chain and reaching validator
            consensus on the winner — this takes 30–90 seconds while validators
            run LLM inference.
          </div>
        )}
      </div>
    </article>
  );
}
