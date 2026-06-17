import { useEffect, useState } from "react";

type Phase = "idle" | "highlight-a" | "highlight-b" | "result";

const CYCLE_MS = 7000;

const DOC_A_LINES = [
  "Termination clause: 30-day notice",
  "Liability cap: $500,000",
  "Governing law: Delaware",
  "Auto-renewal: Yes, annual",
  "Arbitration: Mandatory",
];

const DOC_B_LINES = [
  "Termination clause: 90-day notice",
  "Liability cap: Uncapped",
  "Governing law: New York",
  "Auto-renewal: No",
  "Arbitration: Optional",
];

const HIGHLIGHT_A = [1, 3];
const HIGHLIGHT_B = [1, 3];

export default function CrossDocAnimation() {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setPhase("idle");
      timers.push(
        setTimeout(() => setPhase("highlight-a"), 700),
        setTimeout(() => setPhase("highlight-b"), 1800),
        setTimeout(() => setPhase("result"), 3000),
      );
    }

    run();
    const loop = setInterval(() => {
      timers.forEach(clearTimeout);
      timers = [];
      run();
    }, CYCLE_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, []);

  function lineClass(
    idx: number,
    highlights: number[],
    activePhases: Phase[],
    color: "blue" | "amber",
  ) {
    const isHighlighted =
      highlights.includes(idx) && activePhases.includes(phase);
    const base =
      "text-[10px] font-mono leading-relaxed truncate px-1.5 py-0.5 rounded transition-all duration-300";
    if (isHighlighted) {
      return color === "blue"
        ? `${base} bg-blue-100 text-blue-800`
        : `${base} bg-amber-100 text-amber-800`;
    }
    return `${base} text-gray-400`;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden select-none">
      {/* Title bar */}
      <div className="border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <span className="text-xs font-medium text-gray-500">
          Cross-Document Compare
        </span>
      </div>

      <div className="px-4 py-4 space-y-3 min-h-[220px]">
        {/* Two doc columns */}
        <div className="grid grid-cols-2 gap-3">
          {/* Doc A */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Doc A
              </span>
            </div>
            <div className="border border-gray-100 rounded-lg p-2 space-y-0.5 bg-gray-50">
              {DOC_A_LINES.map((line, i) => (
                <div
                  key={i}
                  className={lineClass(
                    i,
                    HIGHLIGHT_A,
                    ["highlight-a", "highlight-b", "result"],
                    "blue",
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          {/* Doc B */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Doc B
              </span>
            </div>
            <div className="border border-gray-100 rounded-lg p-2 space-y-0.5 bg-gray-50">
              {DOC_B_LINES.map((line, i) => (
                <div
                  key={i}
                  className={lineClass(
                    i,
                    HIGHLIGHT_B,
                    ["highlight-b", "result"],
                    "amber",
                  )}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Result card */}
        <div
          className={`border rounded-lg px-3 py-2 transition-all duration-500 ${
            phase === "result"
              ? "opacity-100 translate-y-0 border-gray-200 bg-gray-50"
              : "opacity-0 translate-y-2 border-transparent bg-transparent"
          }`}
        >
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Key Differences
          </p>
          <p className="text-xs text-gray-700 leading-relaxed">
            Doc B has <span className="text-amber-700 font-medium">uncapped liability</span> vs. Doc A's{" "}
            <span className="text-blue-700 font-medium">$500K cap</span>, and a{" "}
            <span className="text-amber-700 font-medium">90-day</span> vs.{" "}
            <span className="text-blue-700 font-medium">30-day</span> termination window.
          </p>
        </div>
      </div>
    </div>
  );
}
