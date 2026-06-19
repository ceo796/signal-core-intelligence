import { Link } from "wouter";
import { useAuth } from "@clerk/react";

const LANDING_CSS = `
.s87-landing {
  --bg: #111211;
  --bg-deep: #080908;
  --surface: #171817;
  --surface-2: #eef0e8;
  --ink: #eeeee7;
  --muted: #b8bab2;
  --muted-dark: #59645e;
  --line: rgba(238, 238, 231, 0.12);
  --green: #6fd2ad;
  --green-deep: #0e4f3c;
  --green-soft: #d9eee2;
  --cream: #f4f2e8;
  --shadow: 0 40px 120px rgba(0, 0, 0, 0.42);
  --radius-xl: 28px;
  --radius-lg: 22px;
  --radius-pill: 999px;

  font-family: "Inter", "Helvetica Neue", Helvetica, Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  letter-spacing: -0.015em;
  scroll-behavior: smooth;
}

.s87-landing *,
.s87-landing *::before,
.s87-landing *::after {
  box-sizing: border-box;
}

.s87-landing a {
  color: inherit;
  text-decoration: none;
}

.s87-landing .topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(8, 9, 8, 0.82);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.s87-landing .nav {
  width: min(1280px, calc(100% - 48px));
  height: 88px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
}

.s87-landing .brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 540;
  font-size: 21px;
  letter-spacing: -0.04em;
}

.s87-landing .mark {
  width: 22px;
  height: 22px;
  position: relative;
  display: inline-block;
}

.s87-landing .mark::before,
.s87-landing .mark::after {
  content: "";
  position: absolute;
  background: var(--ink);
  border-radius: 3px;
}

.s87-landing .mark::before {
  width: 16px;
  height: 7px;
  left: 0;
  top: 3px;
}

.s87-landing .mark::after {
  width: 16px;
  height: 7px;
  right: 0;
  bottom: 3px;
}

.s87-landing .navlinks {
  display: flex;
  align-items: center;
  gap: 30px;
  color: rgba(238, 238, 231, 0.78);
  font-size: 14px;
  margin-right: auto;
  margin-left: 26px;
}

.s87-landing .navlinks a {
  transition: color 180ms ease;
}

.s87-landing .navlinks a:hover {
  color: var(--ink);
}

.s87-landing .nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.s87-landing .signin {
  transition: color 180ms ease;
  color: rgba(238, 238, 231, 0.78);
}

.s87-landing .signin:hover {
  color: var(--ink);
}

.s87-landing .pill {
  border: 1px solid rgba(238, 238, 231, 0.18);
  border-radius: var(--radius-pill);
  padding: 13px 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.s87-landing .pill:hover {
  transform: translateY(-1px);
  border-color: rgba(238, 238, 231, 0.34);
}

.s87-landing .pill.primary {
  background: var(--cream);
  color: #111211;
  border-color: var(--cream);
}

.s87-landing .pill.outline-green {
  border-color: rgba(111, 210, 173, 0.65);
  color: var(--ink);
  background: rgba(111, 210, 173, 0.03);
}

.s87-landing .hero {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  min-height: calc(100vh - 88px);
  display: grid;
  grid-template-columns: 0.88fr 1.12fr;
  gap: 72px;
  align-items: center;
  padding: 78px 0 56px;
}

.s87-landing .kicker {
  color: rgba(238, 238, 231, 0.78);
  font-size: 22px;
  font-weight: 400;
  margin-bottom: 58px;
  letter-spacing: -0.035em;
}

.s87-landing h1 {
  font-size: clamp(54px, 6.1vw, 92px);
  line-height: 0.98;
  letter-spacing: -0.075em;
  font-weight: 390;
  max-width: 640px;
  text-wrap: balance;
}

.s87-landing .hero-copy {
  color: rgba(238, 238, 231, 0.82);
  font-size: 18px;
  line-height: 1.52;
  max-width: 500px;
  margin-top: 28px;
  letter-spacing: -0.02em;
}

.s87-landing .hero-actions {
  display: flex;
  gap: 12px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.s87-landing .showcase {
  position: relative;
  min-height: 600px;
  overflow: hidden;
  border-radius: 4px;
}

.s87-landing .showcase::before {
  content: "";
  position: absolute;
  inset: 40px 0 0 10px;
  background:
    radial-gradient(circle at 28% 36%, rgba(111, 210, 173, 0.28), transparent 28%),
    radial-gradient(circle at 70% 50%, rgba(226, 237, 215, 0.16), transparent 30%),
    linear-gradient(135deg, rgba(11, 48, 36, 0.88), rgba(49, 82, 45, 0.55), rgba(12, 14, 13, 0.2));
  filter: blur(0.1px);
}

.s87-landing .mosaic {
  position: relative;
  height: 600px;
  display: grid;
  grid-template-columns: 1fr 1.06fr 0.64fr;
  grid-template-rows: 148px 245px 170px;
  gap: 22px;
  transform: translateX(22px);
}

.s87-landing .mock {
  border-radius: 9px;
  background: var(--surface-2);
  color: #123b2e;
  box-shadow: var(--shadow);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.38);
  position: relative;
}

.s87-landing .mock.dark {
  background: #070b0a;
  color: var(--ink);
}

.s87-landing .mock.a {
  grid-column: 1 / 3;
  grid-row: 1 / 2;
}

.s87-landing .mock.b {
  grid-column: 2 / 4;
  grid-row: 2 / 3;
}

.s87-landing .mock.c {
  grid-column: 1 / 2;
  grid-row: 2 / 4;
  transform: translateX(-70px);
}

.s87-landing .mock.d {
  grid-column: 2 / 4;
  grid-row: 3 / 4;
  transform: translateX(34px);
}

.s87-landing .mock.e {
  grid-column: 3 / 4;
  grid-row: 1 / 3;
  transform: translateX(18px);
}

.s87-landing .mock-header {
  height: 44px;
  background: rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(18, 59, 46, 0.08);
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  color: rgba(18, 59, 46, 0.48);
  font-size: 11px;
}

.s87-landing .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(18, 59, 46, 0.15);
}

.s87-landing .mock-content {
  padding: 18px;
}

.s87-landing .metric-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.s87-landing .metric {
  background: #ffffff;
  border: 1px solid rgba(18, 59, 46, 0.08);
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 14px 24px rgba(15, 40, 30, 0.08);
}

.s87-landing .metric small {
  display: block;
  color: rgba(18, 59, 46, 0.54);
  font-size: 10px;
  margin-bottom: 8px;
}

.s87-landing .metric strong {
  display: block;
  font-size: 24px;
  letter-spacing: -0.06em;
}

.s87-landing .bar-list {
  display: grid;
  gap: 12px;
  margin-top: 6px;
}

.s87-landing .bar-item {
  background: #ffffff;
  border-radius: 12px;
  padding: 13px;
  border: 1px solid rgba(18, 59, 46, 0.08);
}

.s87-landing .bar-label {
  display: flex;
  justify-content: space-between;
  color: #1b4336;
  font-size: 11px;
  margin-bottom: 9px;
}

.s87-landing .bar {
  height: 8px;
  background: #e1ebe5;
  border-radius: 999px;
  overflow: hidden;
}

.s87-landing .bar span {
  display: block;
  height: 100%;
  width: var(--w);
  background: linear-gradient(90deg, #76d6b3, #0e6b50);
  border-radius: inherit;
}

.s87-landing .doc-card {
  display: grid;
  gap: 10px;
}

.s87-landing .doc-line {
  height: 13px;
  border-radius: 999px;
  background: rgba(18, 59, 46, 0.12);
}

.s87-landing .doc-line.short { width: 66%; }
.s87-landing .doc-line.mid { width: 82%; }

.s87-landing .chat-bubble {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.045);
  padding: 14px;
  margin-bottom: 10px;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(238, 238, 231, 0.78);
}

.s87-landing .trace {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.s87-landing .trace span {
  border: 1px solid rgba(111, 210, 173, 0.38);
  color: #bcebd8;
  border-radius: 999px;
  padding: 7px 9px;
  font-size: 10px;
}

.s87-landing .section {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  padding: 96px 0;
  border-top: 1px solid var(--line);
}

.s87-landing .section.split {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 80px;
  align-items: center;
}

.s87-landing h2 {
  font-size: clamp(44px, 5vw, 72px);
  font-weight: 390;
  line-height: 0.98;
  letter-spacing: -0.075em;
  text-wrap: balance;
}

.s87-landing .section p {
  color: rgba(238, 238, 231, 0.78);
  font-size: 18px;
  line-height: 1.55;
  max-width: 520px;
  margin-top: 20px;
}

.s87-landing .security-visual {
  min-height: 520px;
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.82), rgba(219, 238, 226, 0.98) 38%, rgba(197, 226, 212, 0.92) 62%, rgba(214, 224, 207, 0.9));
  color: #0d513d;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: var(--shadow);
}

.s87-landing .security-visual::before,
.s87-landing .security-visual::after {
  content: "";
  position: absolute;
  border: 1px solid rgba(14, 111, 80, 0.46);
  border-radius: 50%;
  inset: 160px -160px auto -160px;
  height: 260px;
}

.s87-landing .security-visual::after {
  inset: 215px -230px auto -230px;
  height: 360px;
}

.s87-landing .floating-window {
  position: absolute;
  left: 64px;
  top: 58px;
  width: 420px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 30px 80px rgba(19, 54, 39, 0.2);
  overflow: hidden;
  border: 1px solid rgba(14, 81, 61, 0.14);
}

.s87-landing .floating-window.small {
  width: 320px;
  left: auto;
  right: 50px;
  top: 118px;
}

.s87-landing .badge {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: var(--radius-pill);
  background: rgba(241, 246, 236, 0.78);
  border: 1px solid rgba(14, 111, 80, 0.35);
  color: #0e513d;
  font-size: 13px;
  letter-spacing: 0.03em;
  box-shadow: 0 18px 40px rgba(19, 54, 39, 0.12);
}

.s87-landing .badge.one { left: 92px; bottom: 168px; }
.s87-landing .badge.two { left: 365px; bottom: 100px; }
.s87-landing .badge.three { right: 78px; bottom: 74px; }

.s87-landing .cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 44px;
}

.s87-landing .feature {
  min-height: 240px;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.035);
}

.s87-landing .feature .num {
  color: var(--green);
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.s87-landing .feature h3 {
  margin-top: 56px;
  font-size: 26px;
  font-weight: 430;
  letter-spacing: -0.055em;
}

.s87-landing .feature p {
  font-size: 15px;
  color: rgba(238, 238, 231, 0.66);
  margin-top: 13px;
  line-height: 1.55;
}

.s87-landing .ticker {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  overflow: hidden;
  white-space: nowrap;
  color: rgba(238, 238, 231, 0.72);
  padding: 21px 0;
  font-size: 14px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.s87-landing .ticker-track {
  display: inline-block;
  padding-left: 100%;
  animation: s87-marquee 34s linear infinite;
}

@keyframes s87-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}

@media (prefers-reduced-motion: reduce) {
  .s87-landing .ticker-track {
    animation: none;
  }
  .s87-landing {
    scroll-behavior: auto;
  }
}

.s87-landing .footer {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
  padding: 52px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  color: rgba(238, 238, 231, 0.58);
  font-size: 14px;
  border-top: 1px solid var(--line);
}

.s87-landing .footer-links {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.s87-landing .footer-links a {
  transition: color 180ms ease;
}

.s87-landing .footer-links a:hover {
  color: var(--ink);
}

@media (max-width: 980px) {
  .s87-landing .navlinks {
    display: none;
  }

  .s87-landing .hero,
  .s87-landing .section.split {
    grid-template-columns: 1fr;
    gap: 42px;
  }

  .s87-landing .hero {
    min-height: auto;
    padding-top: 52px;
  }

  .s87-landing .showcase {
    min-height: 480px;
  }

  .s87-landing .mosaic {
    transform: none;
    height: 480px;
    grid-template-columns: 1fr 1fr;
  }

  .s87-landing .mock.e {
    display: none;
  }

  .s87-landing .cards {
    grid-template-columns: 1fr;
  }

  .s87-landing .floating-window {
    left: 24px;
    width: calc(100% - 48px);
  }

  .s87-landing .floating-window.small {
    display: none;
  }

  .s87-landing .badge.one { left: 28px; bottom: 168px; }
  .s87-landing .badge.two { left: 28px; bottom: 104px; }
  .s87-landing .badge.three { right: 28px; bottom: 40px; }
}

@media (max-width: 640px) {
  .s87-landing .nav {
    width: min(100% - 28px, 1280px);
    height: 74px;
  }

  .s87-landing .nav-actions .signin,
  .s87-landing .nav-actions .outline-green {
    display: none;
  }

  .s87-landing .hero,
  .s87-landing .section,
  .s87-landing .footer {
    width: min(100% - 28px, 1280px);
  }

  .s87-landing .kicker {
    margin-bottom: 32px;
  }

  .s87-landing h1 {
    font-size: 52px;
  }

  .s87-landing .showcase {
    min-height: 390px;
  }

  .s87-landing .mosaic {
    height: 390px;
    gap: 12px;
  }

  .s87-landing .mock.c,
  .s87-landing .mock.d {
    transform: none;
  }

  .s87-landing .metric-row {
    grid-template-columns: 1fr;
  }

  .s87-landing .security-visual {
    min-height: 440px;
  }

  .s87-landing .footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();
  const authed = isLoaded && isSignedIn;

  return (
    <div className="s87-landing">
      <style>{LANDING_CSS}</style>

      <header className="topbar">
        <nav className="nav">
          <a className="brand" href="#product" aria-label="Signal87 AI home">
            <span className="mark" aria-hidden="true" />
            <span>Signal87 AI</span>
          </a>

          <div className="navlinks">
            <a href="#product">Product</a>
            <a href="#governance">Governance</a>
            <a href="#workflow">Use cases</a>
            <a href="#security">Security</a>
          </div>

          <div className="nav-actions">
            {authed ? (
              <>
                <Link href="/contact" className="pill outline-green">
                  Book a demo
                </Link>
                <Link href="/documents" className="pill primary">
                  Open App
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="signin">
                  Sign in
                </Link>
                <Link href="/contact" className="pill outline-green">
                  Book a demo
                </Link>
                <Link href="/sign-up" className="pill primary">
                  Start for free
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        <section className="hero" id="product">
          <div>
            <div className="kicker">Document intelligence</div>
            <h1>Extend your team with verifiable AI reasoning.</h1>
            <p className="hero-copy">
              Signal87 AI helps teams analyze, compare, and reason across private
              documents using GPT-powered intelligence, grounded citations, and a
              clear verification trace.
            </p>
            <div className="hero-actions">
              {authed ? (
                <Link href="/documents" className="pill primary">
                  Open App
                </Link>
              ) : (
                <Link href="/sign-up" className="pill primary">
                  Start for free
                </Link>
              )}
              <Link href="/contact" className="pill">
                Book a demo
              </Link>
            </div>
          </div>

          <div
            className="showcase"
            role="img"
            aria-label="Signal87 product interface preview"
          >
            <div className="mosaic">
              <div className="mock a">
                <div className="mock-header">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span>signal87.ai / diligence-overview</span>
                </div>
                <div className="mock-content">
                  <div className="metric-row">
                    <div className="metric">
                      <small>Documents reviewed</small>
                      <strong>148</strong>
                    </div>
                    <div className="metric">
                      <small>Source citations</small>
                      <strong>2,971</strong>
                    </div>
                    <div className="metric">
                      <small>Risk items</small>
                      <strong>37</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mock b">
                <div className="mock-header">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span>comparison brief</span>
                </div>
                <div className="mock-content">
                  <div className="bar-list">
                    <div className="bar-item">
                      <div className="bar-label">
                        <span>Revenue covenant alignment</span>
                        <span>86%</span>
                      </div>
                      <div className="bar">
                        <span style={{ ["--w" as string]: "86%" }} />
                      </div>
                    </div>
                    <div className="bar-item">
                      <div className="bar-label">
                        <span>Change-of-control exposure</span>
                        <span>64%</span>
                      </div>
                      <div className="bar">
                        <span style={{ ["--w" as string]: "64%" }} />
                      </div>
                    </div>
                    <div className="bar-item">
                      <div className="bar-label">
                        <span>Termination language variance</span>
                        <span>72%</span>
                      </div>
                      <div className="bar">
                        <span style={{ ["--w" as string]: "72%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mock c">
                <div className="mock-header">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span>source library</span>
                </div>
                <div className="mock-content">
                  <div className="doc-card">
                    <div className="doc-line" />
                    <div className="doc-line mid" />
                    <div className="doc-line short" />
                    <div className="doc-line" />
                    <div className="doc-line mid" />
                    <div className="doc-line" />
                  </div>
                </div>
              </div>

              <div className="mock dark d">
                <div
                  className="mock-header"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(238,238,231,0.56)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span>verification trace</span>
                </div>
                <div className="mock-content">
                  <div className="chat-bubble">
                    Answer generated with GPT reasoning and source-grounded
                    evidence from selected files.
                    <div className="trace">
                      <span>Chunk 04</span>
                      <span>Chunk 11</span>
                      <span>Agreement B</span>
                      <span>Spreadsheet Q1</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mock e">
                <div className="mock-header">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span>executive brief</span>
                </div>
                <div className="mock-content">
                  <div className="metric" style={{ marginBottom: 12 }}>
                    <small>Confidence</small>
                    <strong>91%</strong>
                  </div>
                  <div className="metric" style={{ marginBottom: 12 }}>
                    <small>Open issues</small>
                    <strong>14</strong>
                  </div>
                  <div className="metric">
                    <small>Docs cited</small>
                    <strong>28</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="ticker">
          <div className="ticker-track">
            GROUNDED ANSWERS · GPT REASONING · DOCUMENT COMPARISON · EXECUTIVE
            BRIEFS · VERIFICATION TRACE · PRIVATE WORKSPACES · SPREADSHEET
            SUPPORT ·
          </div>
        </div>

        <section className="section split" id="governance">
          <div>
            <h2>Ship AI workflows with governance built in.</h2>
            <p>
              Deploy private document intelligence with user access, source
              citations, audit-ready traces, and a controlled path for future
              web research if the product needs it.
            </p>
            <p>
              The core experience remains document-first: users get answers they
              can verify, not unsupported summaries.
            </p>
          </div>

          <div className="security-visual">
            <div className="floating-window">
              <div className="mock-header">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span>risk review workspace</span>
              </div>
              <div className="mock-content">
                <div className="bar-list">
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Source-grounded response</span>
                      <span>Complete</span>
                    </div>
                    <div className="bar">
                      <span style={{ ["--w" as string]: "92%" }} />
                    </div>
                  </div>
                  <div className="bar-item">
                    <div className="bar-label">
                      <span>Trace detail</span>
                      <span>Available</span>
                    </div>
                    <div className="bar">
                      <span style={{ ["--w" as string]: "78%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-window small">
              <div className="mock-header">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                <span>model transparency</span>
              </div>
              <div className="mock-content">
                <div className="doc-card">
                  <div className="doc-line" />
                  <div className="doc-line mid" />
                  <div className="doc-line short" />
                </div>
              </div>
            </div>

            <div className="badge one">Citations</div>
            <div className="badge two">Verification Trace</div>
            <div className="badge three">GPT Reasoning</div>
          </div>
        </section>

        <section className="section" id="workflow">
          <h2>From upload to executive clarity.</h2>
          <p>
            Signal87 turns dense, unstructured material into answers,
            comparisons, briefs, and decision-ready intelligence.
          </p>

          <div className="cards">
            <article className="feature">
              <div className="num">01</div>
              <h3>Upload private files</h3>
              <p>
                Documents, spreadsheets, contracts, diligence files, reports, and
                operating materials become searchable intelligence assets.
              </p>
            </article>

            <article className="feature">
              <div className="num">02</div>
              <h3>Ask better questions</h3>
              <p>
                Use GPT reasoning to summarize, compare, extract risks, and
                synthesize across selected documents.
              </p>
            </article>

            <article className="feature">
              <div className="num">03</div>
              <h3>Verify the answer</h3>
              <p>
                Answers remain connected to source chunks, citations, and
                traceable document evidence.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer" id="security">
        <div>Signal87 AI — Private document intelligence powered by GPT reasoning.</div>
        <nav className="footer-links">
          <Link href="/about">About</Link>
          <Link href="/team">Team</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
