import { useEffect, useState } from "react";

type Phase = "idle" | "question" | "typing" | "answer";

const QUESTION = "What are the key financial risks in this agreement?";
const ANSWER =
  "The agreement carries three primary financial risks: uncapped liability exposure in §4.2, a mandatory arbitration clause that limits recovery, and an auto-renewal provision that extends the term without notice.";
const CITATION = "Source 2, §4.2";

const CYCLE_MS = 6000;

export default function AriaChatAnimation() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function run() {
      setPhase("idle");
      setQuestionText("");
      setAnswerText("");

      timer = setTimeout(() => {
        setPhase("question");
        let i = 0;
        const typeQ = setInterval(() => {
          i++;
          setQuestionText(QUESTION.slice(0, i));
          if (i >= QUESTION.length) {
            clearInterval(typeQ);
            timer = setTimeout(() => {
              setPhase("typing");
              timer = setTimeout(() => {
                setPhase("answer");
                let j = 0;
                const typeA = setInterval(() => {
                  j += 3;
                  setAnswerText(ANSWER.slice(0, j));
                  if (j >= ANSWER.length) clearInterval(typeA);
                }, 18);
              }, 1200);
            }, 400);
          }
        }, 28);
      }, 800);
    }

    run();
    const loop = setInterval(run, CYCLE_MS + 2000);
    return () => {
      clearTimeout(timer);
      clearInterval(loop);
    };
  }, []);

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
              {phase === "question" && questionText.length < QUESTION.length && (
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
                {answerText.length < ANSWER.length && (
                  <span className="inline-block w-0.5 h-3 bg-gray-400 ml-0.5 animate-pulse align-middle" />
                )}
              </p>
              {answerText.length >= ANSWER.length && (
                <div className="pt-0.5">
                  <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono rounded px-1.5 py-0.5">
                    ↗ {CITATION}
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
