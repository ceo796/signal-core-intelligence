import { useEffect, useState } from "react";
import { useGetDemoQa, getGetDemoQaQueryKey } from "@workspace/api-client-react";

type Phase = "idle" | "question" | "typing" | "answer";

// Fallback content, used until the public demo endpoint responds (or if it is
// unavailable). The live endpoint grounds the citation in a real stored
// document; this keeps the panel coherent offline.
const FALLBACK_QUESTION = "What are the key financial risks in this agreement?";
const FALLBACK_ANSWER =
  "The agreement carries three primary financial risks: uncapped liability exposure in §4.2, a mandatory arbitration clause that limits recovery, and an auto-renewal provision that extends the term without notice.";
const FALLBACK_CITATION = "Source 2, §4.2";

const CYCLE_MS = 6000;

export default function AriaChatAnimation() {
  // Public, no-auth endpoint. Never retry / refetch — this is a non-critical
  // landing-page widget that gracefully falls back to the hardcoded copy.
  const { data } = useGetDemoQa({
    query: {
      queryKey: getGetDemoQaQueryKey(),
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  });

  const question = data?.question ?? FALLBACK_QUESTION;
  const answer = data?.answer ?? FALLBACK_ANSWER;
  const citation = data?.citationLabel ?? FALLBACK_CITATION;

  const [phase, setPhase] = useState<Phase>("idle");
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");

  // Re-runs when the demo content loads so the animation plays the real Q&A.
  useEffect(() => {
    const cycleTimers: Array<ReturnType<typeof setTimeout>> = [];
    const cycleIntervals: Array<ReturnType<typeof setInterval>> = [];

    function clearCycle() {
      cycleTimers.forEach(clearTimeout);
      cycleIntervals.forEach(clearInterval);
      cycleTimers.length = 0;
      cycleIntervals.length = 0;
    }

    function run() {
      clearCycle();
      setPhase("idle");
      setQuestionText("");
      setAnswerText("");

      cycleTimers.push(
        setTimeout(() => {
          setPhase("question");
          let i = 0;
          const typeQ = setInterval(() => {
            i++;
            setQuestionText(question.slice(0, i));
            if (i >= question.length) {
              clearInterval(typeQ);
              cycleTimers.push(
                setTimeout(() => {
                  setPhase("typing");
                  cycleTimers.push(
                    setTimeout(() => {
                      setPhase("answer");
                      let j = 0;
                      const typeA = setInterval(() => {
                        j += 3;
                        setAnswerText(answer.slice(0, j));
                        if (j >= answer.length) clearInterval(typeA);
                      }, 18);
                      cycleIntervals.push(typeA);
                    }, 1200),
                  );
                }, 400),
              );
            }
          }, 28);
          cycleIntervals.push(typeQ);
        }, 800),
      );
    }

    run();
    const loop = setInterval(run, CYCLE_MS + 2000);
    return () => {
      clearInterval(loop);
      clearCycle();
    };
  }, [question, answer]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden select-none">
      {/* Title bar */}
      <div className="border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <span className="text-xs font-medium text-gray-500 truncate">
          Document Q&amp;A
        </span>
      </div>

      <div className="px-4 py-4 space-y-3 min-h-[220px]">
        {/* User message */}
        <div
          className={`transition-all duration-500 ${
            phase === "idle"
              ? "opacity-0 translate-y-1"
              : "opacity-100 translate-y-0"
          }`}
        >
          <div className="flex justify-end">
            <div className="bg-blue-600 text-white text-xs rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%]">
              {questionText || "\u00a0"}
              {phase === "question" && questionText.length < question.length && (
                <span className="inline-block w-0.5 h-3 bg-white/80 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        </div>

        {/* Typing indicator */}
        {phase === "typing" && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-400 text-xs rounded-2xl rounded-tl-sm px-3 py-2 flex gap-1 items-center">
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        {/* AI answer */}
        {phase === "answer" && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-700 text-xs rounded-2xl rounded-tl-sm px-3 py-2 max-w-[90%] space-y-1.5">
              <p className="leading-relaxed">
                {answerText}
                {answerText.length < answer.length && (
                  <span className="inline-block w-0.5 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />
                )}
              </p>
              {answerText.length >= answer.length && (
                <div className="pt-0.5">
                  <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono rounded px-1.5 py-0.5">
                    ↗ {citation}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Idle placeholder */}
        {phase === "idle" && (
          <div className="flex items-center justify-center h-28">
            <p className="text-xs text-gray-300 italic">Ask anything…</p>
          </div>
        )}
      </div>
    </div>
  );
}
