// src/App.jsx — composition root. Wires wallet state + on-chain reads and
// hands them down to the presentational sections.

import React, { useCallback, useEffect, useState } from "react";
import {
  CONTRACT_ADDRESS,
  connectWallet,
  autoConnectIfAuthorized,
  hasMetaMask,
  onAccountChange,
  getAddress,
  listBounties,
} from "./genlayer.js";
import "./styles.css";

import Nav from "./sections/Nav.jsx";
import Hero from "./sections/Hero.jsx";
import Stats from "./sections/Stats.jsx";
import Problem from "./sections/Problem.jsx";
import HowItWorks from "./sections/HowItWorks.jsx";
import LiveVerdicts from "./sections/LiveVerdicts.jsx";
import Signals from "./sections/Signals.jsx";
import Architecture from "./sections/Architecture.jsx";
import UseCases from "./sections/UseCases.jsx";
import Compare from "./sections/Compare.jsx";
import FAQ from "./sections/FAQ.jsx";
import HowToUse from "./sections/HowToUse.jsx";
import Footer from "./sections/Footer.jsx";
import ErrorBoundary from "./sections/ErrorBoundary.jsx";

// Wrap a section so a crash inside it does not unmount the rest of the
// page (SECURITY.md § T5).
const guard = (label, node) => (
  <ErrorBoundary label={label}>{node}</ErrorBoundary>
);

export default function App() {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
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
    } catch (e) { setError(e?.message || String(e)); }
  }

  if (!CONTRACT_ADDRESS) {
    return (
      <>
        <Nav me={null} onConnect={() => {}} />
        <div className="section">
          <div className="banner error">
            <strong>No contract address configured.</strong> Set{" "}
            <code>VITE_CONTRACT_ADDRESS</code> on the deployment and rebuild.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Nav me={me} onConnect={handleConnect} />
      <Hero me={me} onConnect={handleConnect} />
      <Stats bounties={bounties} />
      {!hasMetaMask() && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div className="banner warn">
            MetaMask not detected. Install it and reload. Reads work without
            it; writes need a wallet on GenLayer studionet (chain 61999).
          </div>
        </div>
      )}
      {guard("Problem section", <Problem />)}
      {guard("How-it-works section", <HowItWorks />)}
      {guard("Live verdicts", (
        <LiveVerdicts
          bounties={bounties}
          loading={loading}
          refresh={refresh}
          me={me}
          onConnect={handleConnect}
          busy={busy}
          setBusy={setBusy}
          error={error}
          setError={setError}
        />
      ))}
      {guard("Signals section", <Signals />)}
      {guard("Architecture section", <Architecture />)}
      {guard("Use cases section", <UseCases />)}
      {guard("Compare section", <Compare />)}
      {guard("FAQ section", <FAQ />)}
      {guard("How to use section", <HowToUse />)}
      {guard("Footer", <Footer />)}
    </>
  );
}
