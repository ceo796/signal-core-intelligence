import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import "@/styles/landing.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function useRevealObserver() {
  useEffect(() => {
    const els = document.querySelectorAll(".sl-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => e.target.classList.add("visible"), 80);
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    // Capture as const so closures below see non-null types
    const canvas: HTMLCanvasElement = el;
    const c: CanvasRenderingContext2D = ctx;

    let W = 0, H = 0;
    let t = 0;
    let scanX = -200;
    const scanSpeed = 1.1;
    let rafId: number;

    const trace = { amp: 22, freq: 0.010, speed: 0.30, phase: 0 };

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function draw() {
      c.clearRect(0, 0, W, H);
      t += 0.012;

      const yBase = H * 0.5;

      c.beginPath();
      c.strokeStyle = "rgba(10, 20, 40, 0.22)";
      c.lineWidth = 1.2;
      for (let x = 0; x <= W; x += 2) {
        const y =
          yBase +
          Math.sin(x * trace.freq + t * trace.speed + trace.phase) * trace.amp +
          Math.sin(x * trace.freq * 2.4 + t * trace.speed * 1.3) * (trace.amp * 0.18);
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();

      scanX += scanSpeed;
      if (scanX > W + 200) scanX = -200;

      const grad = c.createLinearGradient(scanX - 90, 0, scanX + 90, 0);
      grad.addColorStop(0, "rgba(10,20,40,0)");
      grad.addColorStop(0.42, "rgba(10,20,40,0.06)");
      grad.addColorStop(0.5, "rgba(10,20,40,0.20)");
      grad.addColorStop(0.58, "rgba(10,20,40,0.06)");
      grad.addColorStop(1, "rgba(10,20,40,0)");
      c.fillStyle = grad;
      c.fillRect(scanX - 90, 0, 180, H);

      const dotY =
        yBase +
        Math.sin(scanX * trace.freq + t * trace.speed + trace.phase) * trace.amp +
        Math.sin(scanX * trace.freq * 2.4 + t * trace.speed * 1.3) * (trace.amp * 0.18);
      c.beginPath();
      c.arc(scanX, dotY, 2.5, 0, Math.PI * 2);
      c.fillStyle = "rgba(10, 20, 40, 0.70)";
      c.fill();

      rafId = requestAnimationFrame(draw);
    }

    const resizeHandler = () => resize();
    window.addEventListener("resize", resizeHandler);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return <canvas ref={canvasRef} className="sl-hero-canvas" />;
}

function MiniCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const canvas: HTMLCanvasElement = el;
    const c: CanvasRenderingContext2D = ctx;

    let W = 0, H = 0, t2 = 0;
    let rafId: number;

    const segments = [
      { y: 0.2,  amp: 10, freq: 0.022, speed: 0.26, phase: 0.0 },
      { y: 0.33, amp: 16, freq: 0.018, speed: 0.34, phase: 1.1 },
      { y: 0.46, amp: 12, freq: 0.025, speed: 0.29, phase: 2.3 },
      { y: 0.59, amp: 18, freq: 0.016, speed: 0.38, phase: 0.7 },
      { y: 0.72, amp: 9,  freq: 0.020, speed: 0.31, phase: 1.9 },
      { y: 0.85, amp: 14, freq: 0.023, speed: 0.27, phase: 3.1 },
    ];

    function resize() {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }

    function draw() {
      c.clearRect(0, 0, W, H);
      t2 += 0.012;

      c.strokeStyle = "rgba(10,20,40,0.08)";
      c.lineWidth = 1;
      for (let y = 0; y < H; y += H / 7) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }

      segments.forEach((seg, i) => {
        const yBase = H * seg.y;
        c.beginPath();
        const alpha = 0.10 + i * 0.04;
        c.strokeStyle = `rgba(10, 20, 40, ${alpha})`;
        c.lineWidth = 1;
        for (let x = 0; x <= W; x += 2) {
          const y =
            yBase +
            Math.sin(x * seg.freq + t2 * seg.speed + seg.phase) * seg.amp +
            Math.sin(x * seg.freq * 3.1 + t2 * seg.speed * 0.7) * (seg.amp * 0.2);
          if (x === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      });

      const readX = (t2 * 38) % W;
      const lineGrad = c.createLinearGradient(readX - 40, 0, readX + 2, 0);
      lineGrad.addColorStop(0, "rgba(10,20,40,0)");
      lineGrad.addColorStop(1, "rgba(10,20,40,0.28)");
      c.strokeStyle = lineGrad;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(readX, 0);
      c.lineTo(readX, H);
      c.stroke();

      rafId = requestAnimationFrame(draw);
    }

    const resizeHandler = () => resize();
    window.addEventListener("resize", resizeHandler);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  return <canvas ref={canvasRef} className="sl-mini-canvas" />;
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  useRevealObserver();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="signal87-landing">
      {/* ── NAV ── */}
      <nav className={`sl-nav${scrolled ? " scrolled" : ""}`}>
        <Link href="/" className="sl-nav-logo">
          <span className="sl-logo-mark">
            <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 14 L10 8 L14 12 L18 6 L24 14"
                stroke="#0A1428"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="4" cy="14" r="1.5" fill="#0A1428" opacity="0.5" />
              <circle cx="24" cy="14" r="1.5" fill="#0A1428" opacity="0.5" />
            </svg>
          </span>
          Signal87
        </Link>

        <ul className="sl-nav-links">
          <li><a href="#features">Platform</a></li>
          <li><a href="#verticals">Solutions</a></li>
          <li><Link href="/contact">Contact</Link></li>
        </ul>

        <div className="sl-nav-cta">
          <Link href="/sign-in" className="sl-btn-ghost">Sign in</Link>
          <Link href="/sign-up" className="sl-btn-primary">Request access</Link>
        </div>

        <button
          type="button"
          className="sl-mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </nav>

      {/* ── MOBILE MENU ── */}
      {mobileMenuOpen && (
        <div className="sl-mobile-menu">
          <a href="#features" className="sl-mobile-menu-item" onClick={() => setMobileMenuOpen(false)}>Platform</a>
          <a href="#verticals" className="sl-mobile-menu-item" onClick={() => setMobileMenuOpen(false)}>Solutions</a>
          <Link href="/contact" className="sl-mobile-menu-item" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
          <div className="sl-mobile-menu-actions">
            <Link href="/sign-in" className="sl-btn-ghost" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
            <Link href="/sign-up" className="sl-btn-primary" onClick={() => setMobileMenuOpen(false)}>Request access</Link>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="sl-hero">
        <HeroCanvas />
        <div className="sl-hero-glow" />
        <p className="sl-hero-eyebrow">Intelligent Document Cloud</p>
        <h1 className="sl-hero-headline">
          Documents that<br /><em>think</em> with you
        </h1>
        <p className="sl-hero-sub">
          Signal87 reads across your entire document library — extracting signals,
          synthesizing context, and turning static files into active intelligence.
        </p>
        <div className="sl-hero-actions">
          <Link href="/sign-up" className="sl-btn-large">Get started free</Link>
          <Link href="/contact" className="sl-btn-outline">Talk to us</Link>
        </div>
        <span className="sl-hero-footnote">
          Trusted by legal, finance, and compliance teams
        </span>
      </section>

      {/* ── LOGOS ── */}
      <section className="sl-logos">
        <p className="sl-logos-label">Built for high-stakes document environments</p>
        <div className="sl-logos-row">
          <span className="sl-logo-item">LEGAL OPS</span>
          <span className="sl-logo-item">PRIVATE EQUITY</span>
          <span className="sl-logo-item">COMPLIANCE</span>
          <span className="sl-logo-item">ENTERPRISE</span>
          <span className="sl-logo-item">GOVERNMENT</span>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="sl-features" id="features">
        <p className="sl-section-label sl-reveal">Platform</p>
        <h2 className="sl-section-headline sl-reveal">
          Every document. Every signal. One layer.
        </h2>
        <div className="sl-features-grid sl-reveal">
          <div className="sl-feature-cell">
            <svg className="sl-feature-icon" viewBox="0 0 36 36" fill="none">
              <rect x="6" y="4" width="18" height="24" rx="2" stroke="#0A1428" strokeWidth="1.3" />
              <path d="M10 12h10M10 16h8M10 20h6" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M22 20l8 8" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="26" cy="24" r="4" stroke="#0A1428" strokeWidth="1.3" />
            </svg>
            <h3 className="sl-feature-title">Document Intelligence</h3>
            <p className="sl-feature-desc">
              Ingest any format — PDF, DOCX, CSV, TXT — and surface meaning automatically.
              Extraction, classification, and structured search across your entire library.
            </p>
          </div>
          <div className="sl-feature-cell">
            <svg className="sl-feature-icon" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="10" stroke="#0A1428" strokeWidth="1.3" />
              <path d="M8 18h4M24 18h4M18 8v4M18 24v4" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="18" cy="18" r="3" fill="#0A1428" opacity="0.4" />
            </svg>
            <h3 className="sl-feature-title">AI Brief Generation</h3>
            <p className="sl-feature-desc">
              Go from a library of source material to a structured brief in seconds.
              The model reasons across documents — not just within them.
            </p>
          </div>
          <div className="sl-feature-cell">
            <svg className="sl-feature-icon" viewBox="0 0 36 36" fill="none">
              <path d="M6 12h24M6 18h16M6 24h20" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M26 22l4 4-4 4" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="sl-feature-title">Signal Timeline</h3>
            <p className="sl-feature-desc">
              Every decision, risk, and relationship extracted from your documents surfaces
              as a datable event — building an intelligence layer that accumulates over time.
            </p>
          </div>
          <div className="sl-feature-cell">
            <svg className="sl-feature-icon" viewBox="0 0 36 36" fill="none">
              <rect x="4" y="8" width="12" height="16" rx="2" stroke="#0A1428" strokeWidth="1.3" />
              <rect x="20" y="8" width="12" height="16" rx="2" stroke="#0A1428" strokeWidth="1.3" />
              <path d="M16 16h4" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <h3 className="sl-feature-title">Due Diligence Rooms</h3>
            <p className="sl-feature-desc">
              Secure deal rooms with permissioned access, AI-generated risk summaries,
              and structured memos drafted as materials arrive.
            </p>
          </div>
          <div className="sl-feature-cell">
            <svg className="sl-feature-icon" viewBox="0 0 36 36" fill="none">
              <path d="M8 28V16l10-8 10 8v12" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="14" y="20" width="8" height="8" rx="1" stroke="#0A1428" strokeWidth="1.3" />
            </svg>
            <h3 className="sl-feature-title">Workflow Automation</h3>
            <p className="sl-feature-desc">
              Build document pipelines with a visual builder. Upload triggers, AI extraction,
              condition logic, and team notifications — no code required.
            </p>
          </div>
          <div className="sl-feature-cell">
            <svg className="sl-feature-icon" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="12" r="5" stroke="#0A1428" strokeWidth="1.3" />
              <path d="M8 28c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#0A1428" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M25 18l3-3M28 18h-3v-3" stroke="#0A1428" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="sl-feature-title">Specialized Agents</h3>
            <p className="sl-feature-desc">
              Deploy purpose-built agents for contract review, research synthesis, or
              competitive monitoring — each with its own connected knowledge base.
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="sl-signal-section">
        <div className="sl-signal-visual sl-reveal">
          <MiniCanvas />
        </div>
        <div className="sl-signal-content">
          <p className="sl-section-label sl-reveal">How it works</p>
          <h2 className="sl-reveal">Reading between the lines — at scale</h2>
          <p className="sl-reveal">
            Signal87 processes your document corpus continuously. Each file is chunked,
            embedded, and indexed — then cross-referenced against every other source to
            surface non-obvious connections that a human reading in sequence would miss.
          </p>
          <div className="sl-stat-row sl-reveal">
            <div>
              <div className="sl-stat-num">10<span>×</span></div>
              <div className="sl-stat-label">faster review cycles</div>
            </div>
            <div>
              <div className="sl-stat-num">98<span>%</span></div>
              <div className="sl-stat-label">extraction accuracy</div>
            </div>
            <div>
              <div className="sl-stat-num">E2E<span> enc</span></div>
              <div className="sl-stat-label">end-to-end encrypted</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VERTICALS ── */}
      <section className="sl-verticals" id="verticals">
        <div className="sl-verticals-header">
          <div>
            <p className="sl-section-label sl-reveal">Solutions</p>
            <h2 className="sl-section-headline sl-reveal" style={{ marginBottom: 0 }}>
              Built for high-stakes document environments
            </h2>
          </div>
        </div>
        <div className="sl-verticals-grid">
          <div className="sl-vertical-card sl-reveal">
            <span className="sl-vertical-icon">⚖</span>
            <div className="sl-vertical-name">Legal</div>
            <p className="sl-vertical-desc">
              Contract extraction, clause comparison, matter intelligence, and litigation
              document review at speed.
            </p>
          </div>
          <div className="sl-vertical-card sl-reveal">
            <span className="sl-vertical-icon">◈</span>
            <div className="sl-vertical-name">Finance</div>
            <p className="sl-vertical-desc">
              Deal flow analysis, due diligence automation, portfolio monitoring, and
              investment committee memo generation.
            </p>
          </div>
          <div className="sl-vertical-card sl-reveal">
            <span className="sl-vertical-icon">◎</span>
            <div className="sl-vertical-name">Compliance</div>
            <p className="sl-vertical-desc">
              Policy mapping, regulatory change monitoring, evidence collection, and
              audit trail documentation.
            </p>
          </div>
          <div className="sl-vertical-card sl-reveal">
            <span className="sl-vertical-icon">⬡</span>
            <div className="sl-vertical-name">Government</div>
            <p className="sl-vertical-desc">
              Inter-agency document intelligence, procurement analysis, and secure
              knowledge management at scale.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="sl-cta-section">
        <div className="sl-cta-glow" />
        <h2>Put your documents to work</h2>
        <p>Join legal, finance, and compliance teams already running on Signal87.</p>
        <div className="sl-cta-actions">
          <Link href="/sign-up" className="sl-btn-large">Get started free</Link>
          <Link href="/contact" className="sl-btn-outline">Talk to us</Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="sl-footer">
        <span className="sl-footer-logo">Signal87</span>
        <ul className="sl-footer-links">
          <li><Link href="/privacy">Privacy</Link></li>
          <li><Link href="/terms">Terms</Link></li>
          <li><Link href="/contact">Contact</Link></li>
        </ul>
        <span className="sl-footer-copy">© {new Date().getFullYear()} Signal87</span>
      </footer>
    </div>
  );
}
