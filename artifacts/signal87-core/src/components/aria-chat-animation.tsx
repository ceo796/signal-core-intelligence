import { useEffect, useRef, useState } from "react";
import { MessageSquare, Zap } from "lucide-react";

const QUESTION = "What is the liability cap in the Acme MSA?";
const ANSWER_LINES = [
  "Based on my analysis of the Acme Master Service Agreement,",
  "the **aggregate liability cap is $2,500,000**, as defined in",
  "Section 12.3 (Limitation of Liability).",
];
const CITATIONS = [
  { doc: "Acme-MSA-2025.pdf", page: "14", quote: "aggregate liability shall not exceed..." },
  { doc: "Acme-MSA-2025.pdf", page: "15", quote: "...exclusive of indemnification obligations" },
];

const fullAnswer = ANSWER_LINES.join(" ");

function renderAnswer(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <span key={i} className="font-semibold text-blue-600">{p.slice(2, -2)}</span>
      : <span key={i}>{p}</span>
  );
}

export function AriaChatAnimation() {
  const [visible, setVisible] = useState(false);
  const [questionChars, setQuestionChars] = useState(0);
  const [phase, setPhase] = useState(0);
  const [answerChars, setAnswerChars] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setPhase(1), 400);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (phase !== 1) return;
    const iv = setInterval(() => {
      setQuestionChars(c => {
        if (c >= QUESTION.length) { clearInterval(iv); setTimeout(() => setPhase(2), 600); return c; }
        return c + 1;
      });
    }, 35);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const iv = setInterval(() => {
      setAnswerChars(c => {
        if (c >= fullAnswer.length) { clearInterval(iv); setTimeout(() => setPhase(3), 500); return c; }
        return c + 1;
      });
    }, 18);
    return () => clearInterval(iv);
  }, [phase]);

  const displayedAnswer = fullAnswer.slice(0, answerChars);

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
      {/* Chrome bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-2 h-2 rounded-full bg-gray-300" />
          ))}
        </div>
        <span className="flex-1 text-center text-[10px] font-mono tracking-wide text-gray-400">
          signal87 · document intelligence
        </span>
        {phase >= 2 && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-blue-500" />
            <span className="text-[9px] font-mono text-blue-500">streaming</span>
          </span>
        )}
      </div>

      <div className="p-5 space-y-4" style={{ minHeight: 300 }}>
        {/* User message */}
        {phase >= 1 && (
          <div className="flex justify-end">
            <div className="px-3.5 py-2 rounded-2xl rounded-br-md max-w-[85%] text-[12px] bg-blue-50 border border-blue-100 text-gray-700">
              {QUESTION.slice(0, questionChars)}
              {questionChars < QUESTION.length && (
                <span className="inline-block w-px h-3 ml-0.5 align-middle animate-pulse bg-blue-500" />
              )}
            </div>
          </div>
        )}

        {/* AI response */}
        {phase >= 2 && (
          <div className="flex gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-50 border border-blue-100"
              style={{ boxShadow: phase === 2 ? "0 0 10px rgba(37,99,235,0.12)" : "none" }}
            >
              <Zap className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="text-[12px] leading-relaxed text-gray-600">
                {renderAnswer(displayedAnswer)}
                {answerChars < fullAnswer.length && (
                  <span className="inline-block w-px h-3 ml-0.5 align-middle animate-pulse bg-blue-500" />
                )}
              </div>

              {/* Citations */}
              {phase >= 3 && (
                <div className="rounded-lg p-3 space-y-2 fade-in bg-gray-50 border border-gray-200">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-gray-400">
                    Sources
                  </p>
                  {CITATIONS.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[10px] fade-in-delayed"
                      style={{ animationDelay: `${200 + i * 150}ms` }}
                    >
                      <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 text-blue-400" />
                      <div>
                        <span className="text-gray-700">{c.doc}</span>
                        <span className="text-gray-400"> · Page {c.page}</span>
                        <p className="mt-0.5 italic text-gray-400">"{c.quote}"</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1 mt-1 border-t border-gray-200">
                    <span className="text-[9px] font-mono text-gray-400">2 sources cited</span>
                    <span className="text-[9px] font-mono text-blue-500">Confidence: 97%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
