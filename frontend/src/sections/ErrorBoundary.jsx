import React from "react";

// A crash in one section (bad bounty payload, a widget's third-party
// child that throws) used to unmount the whole app. Wrapping each
// top-level section keeps the rest of the page interactive and shows
// a boxed diagnostic instead. See SECURITY.md § T5.

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Left as a console log intentionally — no telemetry endpoint.
    // Users can copy this from DevTools when reporting a bug.
    // eslint-disable-next-line no-console
    console.error("[BountyOracle] section crash:", error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const label = this.props.label || "This section";
    return (
      <div className="section">
        <div className="banner error" role="alert">
          <strong>{label} crashed.</strong>{" "}
          The rest of the page is still usable. Details:{" "}
          <code>{String(this.state.error?.message || this.state.error)}</code>
          <div style={{ marginTop: 10 }}>
            <button className="btn-ghost" onClick={this.reset}>Try again</button>
          </div>
        </div>
      </div>
    );
  }
}
