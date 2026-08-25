// src/App.jsx
// BountyOracle — browse bounties, create+fund (as maintainer), claim with a
// PR (as contributor), trigger on-chain AI judgement, watch verdict + payout.
//
// Wallet model: MetaMask signs, contract runs on GenLayer studionet
// (Preview status). See src/genlayer.js.

import React, { useEffect, useState, useCallback } from "react";
import {
  CONTRACT_ADDRESS,
  EXPLORER,
  connectWallet,
  autoConnectIfAuthorized,
  hasMetaMask,
  onAccountChange,
  getAddress,
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

function fmtGEN(base) {
  // base units are 1e18 per GEN. Show either full GEN or base units, whichever
  // reads better for the given magnitude.
  try {
    const b = BigInt(base);
    if (b >= 10n ** 15n) {
      const whole = Number(b / 10n ** 12n) / 1e6;
      return `${whole} GEN`;
    }
    return `${b.toString()} base`;
  } catch {
    return `${base}`;
  }
}

export default function App() {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // {id, action}
  const [error, setError] = useState("");
  const [me, setMe] = useState(getAddress());

  const refresh = useCallback(async () => {
    try {
      setError("");
      const list = await listBounties();
      setBounties(list);
    } catch (e) {
      setError("Could not read bounties. Is VITE_CONTRACT_ADDRESS set on the deployment?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const off = onAccountChange((addr) => setMe(addr));
    autoConnectIfAuthorized().catch(() => {});
    refresh();
    return () => off();
  }, [refresh]);

  async function handleConnect() {
    try {
      setError("");
      const addr = await connectWallet();
      setMe(addr);
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="shell">
        <Banner>
          <strong>No contract address configured.</strong> Set{" "}
          <code>VITE_CONTRACT_ADDRESS</code> in the Vercel project (or your
          local <code>.env</code>) and redeploy.
        </Banner>
      </div>
    );
  }

  return (
    <div className="shell">
      <Header me={me} onConnect={handleConnect} />
      {!hasMetaMask() && (
        <Banner tone="warn">
          MetaMask not detected. Install it, then reload. Reads work without it
          — writes need a wallet on GenLayer studionet (chain 61999).
        </Banner>
      )}
      {hasMetaMask() && !me && (
        <Banner>
          Connect MetaMask to post or claim a bounty. Reads are visible without
          connecting — every bounty below is live state from the contract.
        </Banner>
      )}
      <CreatePanel
        onCreated={refresh}
        setBusy={setBusy}
        busy={busy}
        setError={setError}
        me={me}
        onConnect={handleConnect}
      />
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
                onConnect={handleConnect}
              />
            ))
        )}
      </section>
      <Footer />
    </div>
  );
}

function Header({ me, onConnect }) {
  return (
    <header className="hero">
      <div className="brand">
        <span className="dot" />
        BountyOracle
      </div>
      <p className="tag">
        Lock GEN against a GitHub issue. The contract reads the PR, the diff
        and CI on-chain, judges it with an LLM, and pays the contributor
        itself — no maintainer verdict, no middleman.
      </p>
      <div className="wallet">
        {me ? (
          <>
            <span>connected: <code>{short(me)}</code></span>
            <a
              className="explorer-link"
              href={EXPLORER.address(CONTRACT_ADDRESS)}
              target="_blank"
              rel="noreferrer"
            >
              contract on Explorer ↗
            </a>
          </>
        ) : (
          <button className="primary" onClick={onConnect}>Connect MetaMask</button>
        )}
      </div>
    </header>
  );
}

function CreatePanel({ onCreated, setBusy, busy, setError, me, onConnect }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    issueUrl: "",
    repoFullName: "",
    title: "",
    minConfidence: 70,
    value: 1,
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setError("");
    setBusy({ id: "new", action: "create" });
    try {
      // value is entered in GEN; store base units (1e18).
      const base = BigInt(Math.floor(Number(form.value) * 1e6)) * (10n ** 12n);
      await createBounty({
        issueUrl: form.issueUrl.trim(),
        repoFullName: form.repoFullName.trim(),
        title: form.title.trim(),
        minConfidence: Number(form.minConfidence),
        value: base,
      });
      setOpen(false);
      setForm({ issueUrl: "", repoFullName: "", title: "", minConfidence: 70, value: 1 });
      onCreated();
    } catch (e) {
      setError("Create failed: " + (e?.message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="create">
      {me ? (
        <button className="primary" onClick={() => setOpen(!open)}>
          {open ? "Cancel" : "Post a bounty"}
        </button>
      ) : (
        <button className="primary" onClick={onConnect}>
          Connect wallet to post a bounty
        </button>
      )}
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
            <label>Bounty (GEN)
              <input type="number" min="0.000001" step="0.1" value={form.value} onChange={set("value")} />
            </label>
          </div>
          <button className="primary" disabled={busy} onClick={submit}>
            {busy?.action === "create" ? "Signing + funding…" : "Fund bounty"}
          </button>
          <p className="hint">
            The GEN sent with this transaction becomes the escrow. It is
            released to the contributor only if the on-chain AI verdict is
            ACCEPT with confidence ≥ your minimum.
          </p>
        </div>
      )}
    </section>
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
          <span className="amount">{fmtGEN(b.amount)}</span>
        </div>
        <h3>{b.title || "(untitled bounty)"}</h3>
        <div className="meta">
          <a href={b.issue_url} target="_blank" rel="noreferrer">{b.repo_full_name} · issue ↗</a>
          {b.pr_url && <a href={b.pr_url} target="_blank" rel="noreferrer">PR ↗</a>}
          <span>maintainer {short(b.maintainer)}</span>
          {b.contributor && !b.contributor.endsWith("0000") && (
            <span>contributor {short(b.contributor)}</span>
          )}
          <span>min conf {b.min_confidence}%</span>
        </div>

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
                  className="primary"
                  disabled={busy || !prUrl}
                  onClick={() => run("claim", () => claimBounty({ id: b.bounty_id, prUrl: prUrl.trim() }))}
                >
                  {busy?.id === b.bounty_id && busy?.action === "claim" ? "Claiming…" : "Claim with PR"}
                </button>
              </div>
            ) : (
              <button className="ghost" onClick={onConnect}>Connect wallet to claim</button>
            )
          )}

          {b.status === "CLAIMED" && (
            me ? (
              <button
                className="accent"
                disabled={busy}
                onClick={() => run("resolve", () => resolveBounty({ id: b.bounty_id }))}
              >
                {judging ? "AI judging on-chain…" : "Run AI judgement"}
              </button>
            ) : (
              <button className="ghost" onClick={onConnect}>Connect wallet to run judgement</button>
            )
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
            Reading GitHub on-chain and reaching validator consensus — this
            can take 30–90 seconds depending on validator load.
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
      Settlement runs inside an Intelligent Contract on GenLayer studionet
      (Preview). Contract{" "}
      <a href={EXPLORER.address(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">
        <code>{short(CONTRACT_ADDRESS)}</code> ↗
      </a>
    </footer>
  );
}
