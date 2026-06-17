import { useEffect, useRef, useState } from "react";
import { FileText, MessageSquare, Zap } from "lucide-react";

const DOCS = ["Innovate-NDA-2024.pdf", "Vertex-NDA-2025.pdf"];
const QUESTION = "Where do these contracts differ on IP?";
const FULL_ANSWER =
  "Innovate-NDA covers **all IP created during engagement**, while Vertex-NDA limits assignment to the Statement of Work scope only.";
const CITATIONS = [
  { doc: "Innovate-NDA-2024.pdf", page: "3", quote: "all IP developed during engagement..." },
  { doc: "Vertex-NDA-2025.pdf", page: "7", quote: "limited to SoW deliverables only" },
];

function renderAnswer(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <span key={i} className="font-semibold text-blue-600">{p.slice(2, -2)}</span>
      : <span key={i}>{p}</span>
  );
}

export function CrossDocAnimation() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);
  const [questionChars, setQuestionChars] = useState(0);
  const [answerChars, setAnswerChars] = useState(0);
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
    const t = setTimeout(() => setPhase(1), 500);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (phase !== 1) return;
    const t = setTimeout(() => setPhase(2), 700);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 2) return;
    const iv = setInterval(() => {
      setQuestionChars(c => {
        if (c >= QUESTION.length) {
          clearInterval(iv);
          setTimeout(() => setPhase(3), 500);
          return c;
        }
        return c + 1;
      });
    }, 38);
    return () => clearInterval(iv);
  }, [phase]);

  useEffect(() => {
    if (phase !== 3) return;
    const iv = setInterval(() => {
      setAnswerChars(c => {
        if (c >= FULL_ANSWER.length) {
          clearInterval(iv);
          setTimeout(() => {
            setPhase(4);
            setTimeout(() => {
              setPhase(0);
              setQuestionChars(0);
              setAnswerChars(0);
              setTimeout(() => setPhase(1), 600);
            }, 2600);
          }, 400);
          return c;
        }
        return c + 1;
      });
    }, 20);
    return () => clearInterval(iv);
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
          signal87 · compare
        </span>
        {phase >= 3 && phase < 4 && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-blue-500" />
            <span className="text-[9px] font-mono text-blue-500">streaming</span>
          </span>
        )}
      </div>

      <div className="p-4 space-y-3" style={{ minHeight: 260 }}>
        {/* Doc pills */}
        {phase >= 1 && (
          <div
            className="flex flex-wrap gap-2"
            style={{
              opacity: phase >= 1 ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          >
            {DOCS.map((doc, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-[10px] text-gray-600"
                style={{
                  opacity: phase >= 1 ? 1 : 0,
                  transition: `opacity 0.3s ease ${i * 150}ms`,
                }}
              >
                <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                {doc}
              </div>
            ))}
          </div>
        )}

        {/* User question */}
        {phase >= 2 && (
          <div className="flex justify-end">
            <div className="px-3 py-2 rounded-2xl rounded-br-md max-w-[90%] text-[12px] bg-blue-50 border border-blue-100 text-gray-700">
              {QUESTION.slice(0, questionChars)}
              {questionChars < QUESTION.length && (
                <span className="inline-block w-px h-3 ml-0.5 align-middle animate-pulse bg-blue-500" />
              )}
            </div>
          </div>
        )}

        {/* AI response */}
        {phase >= 3 && (
          <div className="flex gap-2.5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-50 border border-blue-100"
              style={{ boxShadow: phase === 3 ? "0 0 8px rgba(37,99,235,0.12)" : "none" }}
            >
              <Zap className="w-3 h-3 text-blue-600" />
            </div>
            <div className="flex-1 space-y-2.5">
              <div className="text-[12px] leading-relaxed text-gray-600">
                {renderAnswer(FULL_ANSWER.slice(0, answerChars))}
                {answerChars < FULL_ANSWER.length && (
                  <span className="inline-block w-px h-3 ml-0.5 align-middle animate-pulse bg-blue-500" />
                )}
              </div>

              {phase >= 4 && (
                <div className="rounded-lg p-2.5 space-y-1.5 fade-in bg-gray-50 border border-gray-200">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-gray-400">Sources</p>
                  {CITATIONS.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-[10px] fade-in-delayed"
                      style={{ animationDelay: `${150 + i * 130}ms` }}
                    >
                      <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 text-blue-400" />
                      <div>
                        <span className="text-gray-700">{c.doc}</span>
                        <span className="text-gray-400"> · p.{c.page}</span>
                        <p className="mt-0.5 italic text-gray-400">"{c.quote}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
