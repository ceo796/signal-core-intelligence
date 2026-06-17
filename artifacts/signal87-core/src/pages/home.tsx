import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Database, Zap, Linkedin, LogIn } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   Particle canvas — ported from the minimalist orb animation spec.
   Runs on its own <canvas> that fills the page behind all content.
───────────────────────────────────────────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const palette = [
      { color: "#0f172a", alpha: 0.12 },
      { color: "#334155", alpha: 0.10 },
      { color: "#0ea5e9", alpha: 0.08 },
      { color: "#64748b", alpha: 0.09 },
    ];

    const config = {
      orbCount: 18,
      baseSpeed: 0.35,
      attractionStrength: 0.35,
      showLines: true,
      maxLineDistance: 180,
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    const mouse = { x: 0, y: 0, active: false };

    interface Orb {
      x: number; y: number;
      vx: number; vy: number;
      size: number; depth: number;
      hue: { color: string; alpha: number };
    }

    let orbs: Orb[] = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    function makeOrb(randomPos = true): Orb {
      return {
        x: randomPos ? Math.random() * width : width / 2,
        y: randomPos ? Math.random() * height : height / 2,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 3.5 + 1.8,
        depth: Math.random() * 0.6 + 0.4,
        hue: palette[Math.floor(Math.random() * palette.length)],
      };
    }

    function initOrbs() {
      orbs = Array.from({ length: config.orbCount }, () => makeOrb(true));
    }

    function updateOrb(o: Orb) {
      o.x += o.vx * config.baseSpeed;
      o.y += o.vy * config.baseSpeed;

      const cx = width / 2;
      const cy = height / 2;
      o.vx += (cx - o.x) * 0.000008;
      o.vy += (cy - o.y) * 0.000008;

      if (mouse.active) {
        const dx = mouse.x - o.x;
        const dy = mouse.y - o.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (config.attractionStrength * o.depth) / (dist * 0.008 + 1);
        o.vx += dx * force * 0.012;
        o.vy += dy * force * 0.012;
      }

      o.vx *= 0.982;
      o.vy *= 0.982;

      if (o.x < -50) o.x = width + 50;
      if (o.x > width + 50) o.x = -50;
      if (o.y < -50) o.y = height + 50;
      if (o.y > height + 50) o.y = -50;
    }

    function drawOrb(o: Orb) {
      ctx.save();
      ctx.globalAlpha = o.hue.alpha;
      ctx.fillStyle = o.hue.color;
      ctx.shadowColor = o.hue.color;
      ctx.shadowBlur = o.size * 2.5;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function drawConnections() {
      if (!config.showLines) return;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
          const dx = orbs[i].x - orbs[j].x;
          const dy = orbs[i].y - orbs[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < config.maxLineDistance) {
            ctx.globalAlpha = (1 - dist / config.maxLineDistance) * 0.18;
            ctx.beginPath();
            ctx.moveTo(orbs[i].x, orbs[i].y);
            ctx.lineTo(orbs[j].x, orbs[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (const o of orbs) { updateOrb(o); drawOrb(o); }
      drawConnections();
      rafId = requestAnimationFrame(animate);
    }

    // Mouse interaction
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      mouse.x = e.touches[0].clientX - r.left;
      mouse.y = e.touches[0].clientY - r.top;
      mouse.active = true;
    };
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(rafId); }
      else if (!prefersReduced) { animate(); }
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("touchmove", onTouch, { passive: false });
    canvas.addEventListener("touchend", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReduced = mq.matches;
    const onMqChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
      if (prefersReduced) cancelAnimationFrame(rafId);
      else animate();
    };
    mq.addEventListener("change", onMqChange);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { resize(); initOrbs(); }, 150);
    };
    window.addEventListener("resize", onResize);

    resize();
    initOrbs();
    if (!prefersReduced) animate();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("touchmove", onTouch);
      canvas.removeEventListener("touchend", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────────── */
export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="min-h-screen text-gray-900 flex flex-col font-sans selection:bg-blue-500/30 bg-white relative overflow-hidden">
      {/* Full-page particle background */}
      <ParticleCanvas />

      <header className="relative z-10 p-6 flex justify-between items-center border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <img src="/signal87-logo-black.svg" alt="Signal87" className="h-10 w-auto" />
        <nav className="flex items-center gap-6 text-sm text-gray-500">
          <Link href="/about" className="hidden sm:block hover:text-gray-900 transition-colors">About</Link>
          <Link href="/team" className="hidden sm:block hover:text-gray-900 transition-colors">Team</Link>
          <Link href="/contact" className="hidden sm:block hover:text-gray-900 transition-colors">Contact</Link>
          {isLoaded && isSignedIn ? (
            <Link href="/documents" className="text-blue-600 hover:text-blue-500 font-medium transition-colors">
              Open App
            </Link>
          ) : (
            <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 font-medium transition-colors">
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </nav>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full">
        <div
          className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm text-xs font-mono text-gray-500 border border-gray-200"
          style={{ animation: "s87-fade-up 0.5s ease both" }}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          AI-powered · Cites every source
        </div>

        <h1
          className="text-5xl md:text-7xl font-normal tracking-tight mb-6 text-gray-900"
          style={{ animation: "s87-fade-up 0.5s 0.12s ease both" }}
        >
          Precision Document Intelligence.
        </h1>

        <p
          className="text-lg text-gray-500 mb-10 max-w-xl text-balance"
          style={{ animation: "s87-fade-up 0.5s 0.24s ease both" }}
        >
          Upload any PDF, DOCX, or text file. Ask questions. Get answers that cite exactly where they came from.
        </p>

        <div style={{ animation: "s87-fade-up 0.5s 0.36s ease both" }}>
          {isLoaded && isSignedIn ? (
            <Link href="/documents" className="inline-block">
              <Button size="lg" className="gap-2 h-12 px-8 group bg-blue-600 hover:bg-blue-500 text-white border-0">
                Open App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ) : (
            <Link href="/sign-in" className="inline-block">
              <Button size="lg" className="gap-2 h-12 px-8 group bg-blue-600 hover:bg-blue-500 text-white border-0">
                <LogIn className="w-4 h-4" />
                Sign In
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          )}
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full border-t border-gray-200 pt-12">
          <div className="space-y-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Verified Citations</h3>
            <p className="text-xs text-gray-500">Every answer cites the exact passages it came from, so you can verify any claim.</p>
          </div>
          <div className="space-y-3">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Verification Trace</h3>
            <p className="text-xs text-gray-500">See which AI model answered, how long it took, and which sections of your document it read.</p>
          </div>
          <div className="space-y-3">
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Rapid Analysis</h3>
            <p className="text-xs text-gray-500">Works with PDFs, Word documents, spreadsheets, and plain text files.</p>
          </div>
        </div>

        <div className="w-full border-t border-gray-200 mt-16 pt-12">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-medium">Partners &amp; Accelerators</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <img src="/google-for-startups.jpg" alt="Google for Startups" className="h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
            <img src="/nvidia-inception-badge.jpg" alt="NVIDIA Inception Program" className="h-12 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-gray-200 px-6 py-12 text-xs text-gray-400 bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span>© 2026 Signal87 AI. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <a href="https://www.linkedin.com/company/signal87-ai/" target="_blank" rel="noopener noreferrer" aria-label="Signal87 AI on LinkedIn" className="hover:text-gray-900 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="https://theresanaiforthat.com/ai/signal87-ai/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">
                There's An AI For That ↗
              </a>
            </div>
          </div>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
            <Link href="/team" className="hover:text-gray-900 transition-colors">Team</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Use</Link>
            <Link href="/contact" className="hover:text-gray-900 transition-colors">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
