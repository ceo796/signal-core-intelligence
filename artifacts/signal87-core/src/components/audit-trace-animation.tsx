import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileSearch } from "lucide-react";

const ANSWER =
  "The aggregate liability cap is $2,500,000 per Section 12.3 (Limitation of Liability).";

const SOURCES = [
  { id: 1, doc: "Acme-MSA-2025.pdf", page: "14", text: "aggregate liability shall not exceed..." },
  { id: 2, doc: "Acme-MSA-2025.pdf", page: "15", text: "...exclusive of indemnification obligations" },
];

function renderAnswerWithCitations(text: string) {
  return (
    <>
      {text}
      <sup className="ml-0.5 text-[9px] text-blue-500 font-mono">[1]</sup>
      <sup className="ml-0.5 text-[9px] text-blue-500 font-mono">[2]</sup>
    </>
  );
}

export function AuditTraceAnimation() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 500);
    return () => clearTimeout(t1);
  }, [visible]);

  useEffect(() => {
    if (phase !== 1) return;
    const t = setTimeout(() => setPhase(2), 900);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const t = setTimeout(() => setPhase(3), 450);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 3) return;
    const t = setTimeout(() => setPhase(4), 350);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 4) return;
    const t = setTimeout(() => {
      setPhase(0);
      setTimeout(() => setPhase(1), 600);
    }, 2800);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      ref={ref}
      className="w-full rounded-xl overflow-hidden border border-gray-200 bg-white"
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.6s cubic-bezier(0.25,1,0.5,1), transform 0.6s cubic-bezier(0.25,1,0.5,1)",
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => <span key={i} className="w-2 h-2 rounded-full bg-gray-300" />)}
        </div>
        <span className="flex-1 text-center text-[10px] font-mono tracking-wide text-gray-400">
          signal87 · verification trace
        </span>
        {phase >= 2 && (
          <span className="flex items-center gap-1">
            <FileSearch className="w-3 h-3 text-blue-400" />
            <span className="text-[9px] font-mono text-blue-500">verified</span>
          </span>
        )}
      </div>

      <div className="p-4 space-y-3" style={{ minHeight: 260 }}>

        {/* Answer block */}
        <div
          style={{
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
            <p className="text-[9px] font-mono uppercase tracking-wider text-gray-400">Answer</p>
            <p className="text-[12px] leading-relaxed text-gray-700">
              {phase >= 1 ? renderAnswerWithCitations(ANSWER) : ""}
            </p>
          </div>
        </div>

        {/* Trace panel */}
        <div
          style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}
        >
          <div className="rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            {/* Trace header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <div className="flex items-center gap-1.5">
                <ChevronDown className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-mono font-medium text-gray-600">Verification Trace</span>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-mono text-gray-400">
                <span>OpenAI · gpt-4o-mini</span>
                <span>4 chunks</span>
                <span>1.24s</span>
              </div>
            </div>

            {/* Sources */}
            <div className="p-2.5 space-y-1.5">
              {SOURCES.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-start gap-2 text-[10px]"
                  style={{
                    opacity: phase >= 3 + i ? 1 : 0,
                    transform: phase >= 3 + i ? "translateY(0)" : "translateY(4px)",
                    transition: "opacity 0.35s ease, transform 0.35s ease",
                  }}
                >
                  <span className="shrink-0 font-mono text-blue-500 font-semibold">[{s.id}]</span>
                  <div>
                    <span className="text-gray-700">{s.doc}</span>
                    <span className="text-gray-400"> · p.{s.page}</span>
                    <p className="mt-0.5 italic text-gray-400">"{s.text}"</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
