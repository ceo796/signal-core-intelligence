'use client';

import { useRef } from "react";

type DocumentVectorCardDoc = {
  title: string;
  folder: string;
  insight: string;
  similarity: number;
};

type DocumentVectorCardProps = {
  doc: DocumentVectorCardDoc;
  onClick?: () => void;
};

const DESKTOP_TRANSFORM =
  "perspective(1600px) rotateX(10deg) rotateY(-14deg) translateZ(15px)";
const MOBILE_TRANSFORM =
  "perspective(1200px) rotateX(5deg) rotateY(-5deg) translateZ(6px)";
const MOBILE_ACTIVE_TRANSFORM =
  "perspective(1200px) rotateX(5deg) rotateY(-5deg) translateZ(6px) scale(0.985)";

function canUseDesktopTilt() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export default function DocumentVectorCard({ doc, onClick }: DocumentVectorCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const similarity = Math.max(0, Math.min(100, Math.round(doc.similarity)));
  const titlePreview = doc.title.split(" ").filter(Boolean).slice(0, 2);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canUseDesktopTilt()) return;

    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 38;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -30;

    card.style.transform = `perspective(1600px) rotateX(${y}deg) rotateY(${x}deg) translateZ(50px)`;
  };

  const resetTransform = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = canUseDesktopTilt() ? DESKTOP_TRANSFORM : MOBILE_TRANSFORM;
  };

  const handleMouseLeave = () => {
    resetTransform();
  };

  const handlePointerDown = () => {
    if (canUseDesktopTilt() || !cardRef.current) return;
    cardRef.current.style.transform = MOBILE_ACTIVE_TRANSFORM;
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={resetTransform}
      onPointerCancel={resetTransform}
      style={{ transform: MOBILE_TRANSFORM, transformStyle: "preserve-3d" }}
      className="vector-card group relative w-full touch-manipulation overflow-hidden rounded-[1.35rem] border border-white/10 bg-zinc-950/95 p-5 text-white shadow-[0_18px_55px_-34px_rgba(15,23,42,0.95)] transition-[transform,box-shadow,border-color,background-color] duration-500 ease-out will-change-transform sm:p-6 md:rounded-3xl md:p-7 lg:p-8 motion-reduce:transform-none motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:hover:border-emerald-300/35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-zinc-900 [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_35px_90px_-28px_rgba(16,185,129,0.55),0_0_55px_-12px_rgba(34,211,238,0.45)]"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-cyan-400/20 opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_34%,rgba(34,211,238,0.08)_72%,transparent)] opacity-60" />

      <div className="relative flex gap-4 sm:gap-5 md:gap-6" style={{ transform: "translateZ(34px)" }}>
        <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-800 shadow-[inset_0_1px_12px_rgba(255,255,255,0.04),0_16px_35px_-20px_rgba(34,211,238,0.8)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-3deg] sm:h-28 sm:w-20">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#222,#222_4px,#333_4px,#333_8px)]" />
          <div className="absolute inset-x-2.5 top-3 h-1.5 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300 sm:inset-x-3" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center font-mono text-[9px] leading-tight text-zinc-300 sm:text-[10px]">
            {titlePreview.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </div>
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-px text-[8px] font-semibold tracking-wide text-cyan-100 sm:text-[9px]">
            PDF
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-base font-semibold leading-tight tracking-[-0.02em] text-zinc-50 transition-colors duration-300 group-hover:text-emerald-50 sm:text-lg">
            {doc.title}
          </div>
          <div className="mt-1 line-clamp-1 text-[11px] text-zinc-500 sm:text-xs">
            {doc.folder} • {similarity}% match
          </div>
          <p className="mt-3 line-clamp-3 text-xs leading-5 text-zinc-300 sm:mt-5 sm:text-sm sm:leading-6">
            {doc.insight}
          </p>

          <div className="mt-5 sm:mt-8">
            <div className="mb-2 flex justify-between text-[11px] text-zinc-500 sm:text-xs">
              <span>Relevance</span>
              <span>{similarity}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800 shadow-inner">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_18px_rgba(45,212,191,0.55)] transition-[width] duration-700 ease-out"
                style={{ width: `${similarity}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
