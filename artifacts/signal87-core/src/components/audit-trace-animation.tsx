import { useEffect, useState } from "react";

type Phase = "idle" | "row1" | "row2" | "row3" | "row4";

const CYCLE_MS = 7000;

const ROWS = [
  { label: "Model", value: "gpt-4o-mini", mono: true },
  { label: "Chunks", value: "8 retrieved", mono: false },
  { label: "Latency", value: "1 340 ms", mono: true },
  { label: "Sources", value: "3 documents", mono: false },
] as const;

const PHASE_ORDER: Phase[] = ["row1", "row2", "row3", "row4"];

export default function AuditTraceAnimation() {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    function run() {
      setPhase("idle");
      PHASE_ORDER.forEach((p, i) => {
        timers.push(setTimeout(() => setPhase(p), 700 + i * 500));
      });
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

  function rowVisible(rowPhase: Phase) {
    const idx = PHASE_ORDER.indexOf(rowPhase);
    const cur = PHASE_ORDER.indexOf(phase);
    return cur >= idx;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden select-none">
      {/* Title bar */}
      <div className="border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <span className="text-xs font-medium text-gray-500">
          Verification Trace
        </span>
      </div>

      <div className="px-4 py-4 min-h-[220px]">
        {/* Header label */}
        <div
          className={`transition-all duration-500 mb-3 ${
            phase === "idle"
              ? "opacity-0 translate-y-1"
              : "opacity-100 translate-y-0"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-mono font-semibold text-gray-500 uppercase tracking-widest">
              Trace · Executive Brief
            </span>
          </div>
        </div>

        {/* Trace rows */}
        <div className="space-y-0 border border-gray-100 rounded-lg overflow-hidden">
          {ROWS.map((row, i) => {
            const rowPhase = PHASE_ORDER[i];
            const visible = rowVisible(rowPhase);
            return (
              <div
                key={row.label}
                className={`flex items-center justify-between px-3 py-2 transition-all duration-400 border-b border-gray-50 last:border-b-0 ${
                  visible
                    ? "opacity-100 bg-white"
                    : "opacity-0 bg-white"
                }`}
                style={{
                  transitionDelay: visible ? "0ms" : "0ms",
                }}
              >
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                  {row.label}
                </span>
                <span
                  className={`text-[10px] font-semibold ${
                    row.mono ? "font-mono text-gray-700" : "text-gray-700"
                  } ${visible ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
                >
                  {row.value}
                </span>
              </div>
            );
          })}
        </div>

        {/* Source chip row */}
        <div
          className={`mt-3 flex flex-wrap gap-1.5 transition-all duration-500 ${
            phase === "row4"
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1"
          }`}
        >
          {["Contract.pdf · §4.2", "Disclosure.docx · p.7", "LOI.pdf · §2"].map(
            (src) => (
              <span
                key={src}
                className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 text-[9px] font-mono rounded px-1.5 py-0.5"
              >
                ↗ {src}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
